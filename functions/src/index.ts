import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import moment from "moment";
import { requestErrorHandler } from "./error-handler";
import { logMessage } from "./log-message";
import { BodyPayload, CustomerInfo, is } from "./types";
import { validateAndGetPayload } from "./validate-and-get-payload";
import { validateApiVersion } from "./validate-api-version";

import { getEventarc } from "firebase-admin/eventarc";
import { Auth } from "firebase-admin/lib/auth/auth";

admin.initializeApp();

const eventChannel = process.env.EVENTARC_CHANNEL
  ? getEventarc().channel(process.env.EVENTARC_CHANNEL, {
      allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
    })
  : null;

const SHARED_SECRET = process.env.REVENUECAT_SHARED_SECRET as string;
const EVENTS_COLLECTION = process.env.REVENUECAT_EVENTS_COLLECTION as
  | string
  | undefined;
const CUSTOMERS_COLLECTION = process.env.REVENUECAT_CUSTOMERS_COLLECTION as
  | string
  | undefined;
const SET_CUSTOM_CLAIMS = process.env.SET_CUSTOM_CLAIMS as
  | "ENABLED"
  | "DISABLED";
const EXTENSION_VERSION = process.env.EXTENSION_VERSION || "0.1.19";

const LAST_EVENT_TIMESTAMP_FIELD = "rc_last_event_timestamp_ms";
const CLAIMS_EVENT_TIMESTAMP_FIELD = "revenueCatEventTimestampMs";

type CustomerUpdate = {
  userId: string;
  customerPayload: CustomerInfo;
  aliases: string[];
};

// An event is stale only when it carries a timestamp that is strictly older than
// the one already applied. A missing timestamp or a stored value that is not a
// number (nothing applied yet) both mean the event is treated as fresh. Equal
// timestamps also apply, since a retry reuses the original event_timestamp_ms
// and must still be able to finish.
const isStale = (
  eventTimestampMs: number | undefined,
  appliedMs: unknown
): boolean =>
  eventTimestampMs !== undefined &&
  typeof appliedMs === "number" &&
  eventTimestampMs < appliedMs;

const getCustomersCollection = ({
  firestore,
  customersCollectionConfig,
  userId,
}: {
  firestore: admin.firestore.Firestore;
  customersCollectionConfig: string;
  userId: string;
}) => {
  return firestore.collection(
    customersCollectionConfig.replace("{app_user_id}", userId)
  );
};

/**
 * Writes each customer update in a single transaction and returns the ids of
 * the customers that were skipped because their last applied event is newer.
 */
const applyCustomerUpdates = async ({
  firestore,
  customersCollectionConfig,
  updates,
  eventTimestampMs,
}: {
  firestore: admin.firestore.Firestore;
  customersCollectionConfig: string;
  updates: CustomerUpdate[];
  eventTimestampMs: number | undefined;
}): Promise<Set<string>> => {
  if (updates.length === 0) {
    // transaction.getAll() rejects an empty list of references.
    return new Set();
  }

  const watermark =
    eventTimestampMs === undefined
      ? {}
      : { [LAST_EVENT_TIMESTAMP_FIELD]: eventTimestampMs };

  // refs do not depend on the transaction attempt, so they can be built once.
  const refs = updates.map((update) =>
    getCustomersCollection({
      firestore,
      customersCollectionConfig,
      userId: update.userId,
    }).doc(update.userId)
  );

  return firestore.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(...refs);

    // Declared inside the callback: runTransaction re-runs it on contention.
    const skipped = new Set<string>();
    updates.forEach((update, index) => {
      const snapshot = snapshots[index];
      if (isStale(eventTimestampMs, snapshot.get(LAST_EVENT_TIMESTAMP_FIELD))) {
        skipped.add(update.userId);
        return;
      }

      const payloadToWrite = {
        ...update.customerPayload,
        aliases: update.aliases,
        ...watermark,
      };

      // update() replaces maps such as `entitlements` wholesale, which is what
      // revocation needs, while leaving fields owned by the developer alone. A
      // merging set() would keep revoked entitlements around forever.
      if (snapshot.exists) {
        transaction.update(refs[index], payloadToWrite);
      } else {
        transaction.set(refs[index], payloadToWrite);
      }
    });

    return skipped;
  });
};

const getActiveEntitlements = ({
  customerPayload,
}: {
  customerPayload: CustomerInfo;
}): string[] => {
  return Object.keys(customerPayload.entitlements).filter((entitlementID) => {
    const expiresDate =
      customerPayload.entitlements[entitlementID].expires_date;
    return expiresDate === null || moment.utc(expiresDate) >= moment.utc();
  });
};

const setCustomClaims = async ({
  auth,
  userId,
  entitlements,
  eventTimestampMs,
}: {
  auth: Auth;
  userId: string;
  entitlements: string[];
  eventTimestampMs: number | undefined;
}) => {
  try {
    const { customClaims } = await auth.getUser(userId);

    // Firebase Auth has no compare-and-set, so this per-claim watermark is what
    // stops a stale event from re-granting claims. It is the only such guard
    // when no customers collection is configured, and it also protects against
    // a concurrent delivery that raced past applyCustomerUpdates.
    if (isStale(eventTimestampMs, customClaims?.[CLAIMS_EVENT_TIMESTAMP_FIELD])) {
      return;
    }

    await admin.auth().setCustomUserClaims(userId, {
      ...(customClaims ? customClaims : {}),
      revenueCatEntitlements: entitlements,
      ...(eventTimestampMs === undefined
        ? {}
        : { [CLAIMS_EVENT_TIMESTAMP_FIELD]: eventTimestampMs }),
    });
  } catch (userError) {
    logMessage(`Error saving user ${userId}: ${userError}`, "error");
  }
};

export const handler = functions.https.onRequest(async (request, response) => {
  try {
    response.header("X-EXTENSION-VERSION", EXTENSION_VERSION);

    const bodyPayload = validateAndGetPayload(SHARED_SECRET)(
      request
    ) as BodyPayload;
    validateApiVersion(bodyPayload, EXTENSION_VERSION);

    const firestore = admin.firestore();
    const auth = admin.auth();

    const eventPayload = bodyPayload.event;
    const customerPayload = bodyPayload.customer_info;
    const destinationUserId = eventPayload.app_user_id;
    const eventTimestampMs =
      typeof eventPayload.event_timestamp_ms === "number"
        ? eventPayload.event_timestamp_ms
        : undefined;

    const eventType = (eventPayload.type || "").toLowerCase();

    if (EVENTS_COLLECTION) {
      await firestore
        .collection(EVENTS_COLLECTION)
        .doc(eventPayload.id)
        .set(eventPayload);
    }

    // Keyed by user id: a transfer whose origin is also its destination must
    // not write the same document twice in one transaction.
    const updatesByUserId = new Map<string, CustomerUpdate>();

    if (destinationUserId) {
      updatesByUserId.set(destinationUserId, {
        userId: destinationUserId,
        customerPayload,
        aliases: eventPayload.aliases,
      });
    }

    if (is(bodyPayload, "TRANSFER") && bodyPayload.event.origin_app_user_id) {
      updatesByUserId.set(bodyPayload.event.origin_app_user_id, {
        userId: bodyPayload.event.origin_app_user_id,
        customerPayload: bodyPayload.origin_customer_info,
        aliases: bodyPayload.event.transferred_from,
      });
    }

    const updates = [...updatesByUserId.values()];

    // Without a customers collection there is nowhere to keep a document
    // watermark, so every document write is treated as fresh; custom claims are
    // still guarded on their own watermark inside setCustomClaims.
    const skippedAsStale = CUSTOMERS_COLLECTION
      ? await applyCustomerUpdates({
          firestore,
          customersCollectionConfig: CUSTOMERS_COLLECTION,
          updates,
          eventTimestampMs,
        })
      : new Set<string>();

    const appliedUpdates = updates.filter(
      (update) => !skippedAsStale.has(update.userId)
    );

    if (SET_CUSTOM_CLAIMS === "ENABLED") {
      await Promise.all(
        appliedUpdates.map((update) =>
          setCustomClaims({
            auth,
            userId: update.userId,
            entitlements: getActiveEntitlements({
              customerPayload: update.customerPayload,
            }),
            eventTimestampMs,
          })
        )
      );
    }

    await eventChannel?.publish({
      type: `com.revenuecat.v1.${eventType}`,
      data: eventPayload,
    });

    response.send({});
  } catch (err) {
    requestErrorHandler(err as Error, response, EXTENSION_VERSION);
  }
});
