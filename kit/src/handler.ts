import { getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import {
  customersCollection,
  eventsCollection,
  location,
  setCustomClaims as setCustomClaimsParam,
  sharedSecret,
} from "./config";
import { requestErrorHandler } from "./error-handler";
import { publishEvent } from "./events";
import { logMessage } from "./log-message";
import { BodyPayload, CustomerInfo, is } from "./types";
import { validateAndGetPayload } from "./validate-and-get-payload";
import { validateApiVersion } from "./validate-api-version";
import { KIT_VERSION } from "./version";

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
  firestore: Firestore;
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
  firestore: Firestore;
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
    return expiresDate === null || new Date(expiresDate) >= new Date();
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

    await auth.setCustomUserClaims(userId, {
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

/** Initializes the default app once, so the kit can share a codebase that already did. */
const ensureApp = () => {
  if (getApps().length === 0) {
    initializeApp();
  }
};

export const handler = onRequest(
  { region: location, secrets: [sharedSecret] },
  async (request, response) => {
    try {
      response.header("X-EXTENSION-VERSION", KIT_VERSION);

      const bodyPayload = validateAndGetPayload(sharedSecret.value())(
        request
      ) as BodyPayload;
      validateApiVersion(bodyPayload, KIT_VERSION);

      ensureApp();
      const firestore = getFirestore();
      const auth = getAuth();
      const eventsCollectionPath = eventsCollection.value();
      const customersCollectionPath = customersCollection.value();
      const customClaimsEnabled = setCustomClaimsParam.value() === "ENABLED";

      const eventPayload = bodyPayload.event;
      const customerPayload = bodyPayload.customer_info;
      const destinationUserId = eventPayload.app_user_id;
      const eventTimestampMs =
        typeof eventPayload.event_timestamp_ms === "number"
          ? eventPayload.event_timestamp_ms
          : undefined;

      const eventType = (eventPayload.type || "").toLowerCase();

      if (eventsCollectionPath) {
        await firestore
          .collection(eventsCollectionPath)
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
      const skippedAsStale = customersCollectionPath
        ? await applyCustomerUpdates({
            firestore,
            customersCollectionConfig: customersCollectionPath,
            updates,
            eventTimestampMs,
          })
        : new Set<string>();

      const appliedUpdates = updates.filter(
        (update) => !skippedAsStale.has(update.userId)
      );

      if (customClaimsEnabled) {
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

      await publishEvent(eventType, eventPayload);

      response.send({});
    } catch (err) {
      requestErrorHandler(err as Error, response, KIT_VERSION);
    }
  }
);
