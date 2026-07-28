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
// firebase-admin does not re-export gRPC status codes, and reaching into
// google-gax as a transitive dependency for them would be worse.
const GRPC_STATUS_ALREADY_EXISTS = 6;

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
 * An event document that exists without EVENT_APPLIED_AT_FIELD comes from a
 * delivery that failed part way through, so it is refreshed and applied again.
 */
const tryClaimEvent = async ({
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
    if ((error as { code?: number }).code !== GRPC_STATUS_ALREADY_EXISTS) {
      throw error;
    }

    const storedEvent = await eventRef.get();
    if (storedEvent.get(EVENT_APPLIED_AT_FIELD) !== undefined) {
      return false;
    }

    await eventRef.set(eventPayload);
    return true;
  }
};

// Anything but a number, including a missing field, means no event has been
// applied to this customer yet.
const storedWatermarkMs = (
  snapshot: admin.firestore.DocumentSnapshot
): number => {
  const storedValue = snapshot.get(LAST_EVENT_TIMESTAMP_FIELD);
  return typeof storedValue === "number"
    ? storedValue
    : Number.NEGATIVE_INFINITY;
};

/**
 * Returns the updates it applied, skipping the customers whose last applied
 * event is newer. Events carrying the same timestamp as the watermark are
 * applied: retries reuse the original event_timestamp_ms and must still be
 * able to finish the work.
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
}): Promise<CustomerUpdate[]> => {
  if (updates.length === 0) {
    // transaction.getAll() rejects an empty list of references.
    return updates;
  }

  const watermark =
    eventTimestampMs === undefined
      ? {}
      : { [LAST_EVENT_TIMESTAMP_FIELD]: eventTimestampMs };

  return firestore.runTransaction(async (transaction) => {
    const refs = updates.map((update) =>
      getCustomersCollection({
        firestore,
        customersCollectionConfig,
        userId: update.userId,
      }).doc(update.userId)
    );
    const snapshots = await transaction.getAll(...refs);

    const fresh = updates
      .map((update, index) => ({
        update,
        ref: refs[index],
        snapshot: snapshots[index],
      }))
      .filter(
        ({ snapshot }) =>
          eventTimestampMs === undefined ||
          eventTimestampMs >= storedWatermarkMs(snapshot)
      );

    fresh.forEach(({ update, ref, snapshot }) => {
      const payloadToWrite = {
        ...update.customerPayload,
        aliases: update.aliases,
        ...watermark,
      };

      // update() replaces maps such as `entitlements` wholesale, which is what
      // revocation needs, while leaving fields owned by the developer alone. A
      // merging set() would keep revoked entitlements around forever.
      if (snapshot.exists) {
        transaction.update(ref, payloadToWrite);
      } else {
        transaction.set(ref, payloadToWrite);
      }
    });

    return fresh.map(({ update }) => update);
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

    const claimed = eventRef
      ? await tryClaimEvent({ eventRef, eventPayload })
      : true;

    if (!claimed) {
      logMessage(`Event ${eventPayload.id} was already applied, skipping`);
      response.send({});
      return;
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

    // Without a customers collection there is nowhere to keep a watermark, so
    // every update is treated as fresh and only the event id guards replays.
    const appliedUpdates = CUSTOMERS_COLLECTION
      ? await applyCustomerUpdates({
          firestore,
          customersCollectionConfig: CUSTOMERS_COLLECTION,
          updates,
          eventTimestampMs,
        })
      : updates;

    if (SET_CUSTOM_CLAIMS === "ENABLED") {
      await Promise.all(
        appliedUpdates.map((update) =>
          setCustomClaims({
            auth,
            userId: update.userId,
            entitlements: getActiveEntitlements({
              customerPayload: update.customerPayload,
            }),
          })
        )
      );
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
