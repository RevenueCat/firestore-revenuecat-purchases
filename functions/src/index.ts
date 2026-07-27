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
const EXTENSION_VERSION = process.env.EXTENSION_VERSION || "0.1.18";

const EVENT_APPLIED_AT_FIELD = "rc_applied_at";
const LAST_EVENT_TIMESTAMP_FIELD = "rc_last_event_timestamp_ms";
const FIRESTORE_ALREADY_EXISTS = 6;

type CustomerUpdate = {
  userId: string;
  customerPayload: CustomerInfo;
  aliases: string[];
};

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
 * Claims the event id so a redelivery of an already applied event is a no-op.
 * An event document that exists without EVENT_APPLIED_AT_FIELD comes from a
 * delivery that failed part way through, so it is applied again.
 */
const claimEvent = async ({
  eventRef,
  eventPayload,
}: {
  eventRef: admin.firestore.DocumentReference;
  eventPayload: BodyPayload["event"];
}): Promise<boolean> => {
  try {
    await eventRef.create(eventPayload);
    return true;
  } catch (error) {
    if ((error as { code?: number }).code !== FIRESTORE_ALREADY_EXISTS) {
      throw error;
    }
    const storedEvent = await eventRef.get();
    return storedEvent.get(EVENT_APPLIED_AT_FIELD) === undefined;
  }
};

/**
 * Writes every customer document touched by the event in a single transaction,
 * skipping the ones whose stored watermark is newer than this event. Returns the
 * user ids that were skipped so their custom claims are left alone too.
 *
 * Events carrying the same timestamp as the watermark are applied: retries reuse
 * the original event_timestamp_ms and must still be able to finish the work.
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
  return firestore.runTransaction(async (transaction) => {
    const refs = updates.map((update) =>
      getCustomersCollection({
        firestore,
        customersCollectionConfig,
        userId: update.userId,
      }).doc(update.userId)
    );
    const snapshots = await transaction.getAll(...refs);
    const staleUserIds = new Set<string>();

    updates.forEach((update, index) => {
      const lastEventTimestampMs = snapshots[index].get(
        LAST_EVENT_TIMESTAMP_FIELD
      );

      if (
        eventTimestampMs !== undefined &&
        typeof lastEventTimestampMs === "number" &&
        eventTimestampMs < lastEventTimestampMs
      ) {
        staleUserIds.add(update.userId);
        return;
      }

      const payloadToWrite = {
        ...update.customerPayload,
        aliases: update.aliases,
        ...(eventTimestampMs === undefined
          ? {}
          : { [LAST_EVENT_TIMESTAMP_FIELD]: eventTimestampMs }),
      };

      // update() replaces maps such as `entitlements` wholesale, which is what
      // revocation needs, while leaving fields owned by the developer alone. A
      // merging set() would keep revoked entitlements around forever, so it is
      // only used to create documents that do not exist yet.
      if (snapshots[index].exists) {
        transaction.update(refs[index], payloadToWrite);
      } else {
        transaction.set(refs[index], payloadToWrite);
      }
    });

    return staleUserIds;
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
}: {
  auth: Auth;
  userId: string;
  entitlements: string[];
}) => {
  try {
    const { customClaims } = await auth.getUser(userId);
    await admin.auth().setCustomUserClaims(userId, {
      ...(customClaims ? customClaims : {}),
      revenueCatEntitlements: entitlements,
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

    const eventRef = EVENTS_COLLECTION
      ? firestore.collection(EVENTS_COLLECTION).doc(eventPayload.id)
      : null;

    if (eventRef && !(await claimEvent({ eventRef, eventPayload }))) {
      logMessage(`Event ${eventPayload.id} was already applied, skipping`);
      response.send({});
      return;
    }

    const updates: CustomerUpdate[] = [];

    if (destinationUserId) {
      updates.push({
        userId: destinationUserId,
        customerPayload,
        aliases: eventPayload.aliases,
      });
    }

    if (is(bodyPayload, "TRANSFER") && bodyPayload.event.origin_app_user_id) {
      updates.push({
        userId: bodyPayload.event.origin_app_user_id,
        customerPayload: bodyPayload.origin_customer_info,
        aliases: bodyPayload.event.transferred_from,
      });
    }

    // Without a customers collection there is nowhere to keep a watermark, so
    // every update is treated as fresh and only the event id guards replays.
    const staleUserIds =
      CUSTOMERS_COLLECTION && updates.length > 0
        ? await applyCustomerUpdates({
            firestore,
            customersCollectionConfig: CUSTOMERS_COLLECTION,
            updates,
            eventTimestampMs,
          })
        : new Set<string>();

    if (SET_CUSTOM_CLAIMS === "ENABLED") {
      for (const update of updates) {
        if (staleUserIds.has(update.userId)) {
          continue;
        }

        await setCustomClaims({
          auth,
          userId: update.userId,
          entitlements: getActiveEntitlements({
            customerPayload: update.customerPayload,
          }),
        });
      }
    }

    await eventChannel?.publish({
      type: `com.revenuecat.v1.${eventType}`,
      data: eventPayload,
    });

    // Marked last so a delivery that fails half way through is retried instead
    // of being skipped as a duplicate.
    await eventRef?.update({ [EVENT_APPLIED_AT_FIELD]: Date.now() });

    response.send({});
  } catch (err) {
    requestErrorHandler(err as Error, response, EXTENSION_VERSION);
  }
});
