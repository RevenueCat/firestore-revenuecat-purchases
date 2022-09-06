import * as functions from "firebase-functions";
import firestoreCloud from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import { validateAndGetPayload } from "./validate-and-get-payload";
import { validateApiVersion } from "./validate-api-version";
import { requestErrorHandler } from "./error-handler";
import moment from "moment";
import { logMessage } from "./log-message";

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
const EXTENSION_VERSION = process.env.EXTENSION_VERSION || "0.1.4";

interface Entitlement {
  expires_date: string;
  purchase_date: string;
  product_identifier: string;
  grace_period_expires_date: string;
}

type EventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS"
  | "NON_RENEWING_PURCHASE"
  | "UNCANCELLATION"
  | "TRANSFER"
  | "SUBSCRIPTION_PAUSED"
  | "EXPIRATION";

type Event =
  | {
      type: Exclude<EventType, "TRANSFER">;
      id: string;
      app_user_id: string;
      subscriber_info: {};
      aliases: string[];
    }
  | {
      type: "TRANSFER";
      id: string;
      store: string;
      transferred_from: string[];
      transferred_to: string[];
    };

interface BodyPayload {
  api_version: string;
  event: Event;
  customer_info: {
    original_app_user_id: string;
    entitlements: { [entitlementIdentifier: string]: Entitlement };
  };
}

const getCustomersCollection = (
  firestore: admin.firestore.Firestore,
  customersCollectionConfig: string,
  userId: string
) => {
  return firestore.collection(
    customersCollectionConfig.replace("{app_user_id}", userId)
  );
};

const writeToCollection = async (
  firestore: admin.firestore.Firestore,
  customersCollectionConfig: string,
  userId: string,
  customerPayload: BodyPayload["customer_info"],
  eventPayload: BodyPayload["event"],
) => {
  const customersCollection = getCustomersCollection(
    firestore,
    customersCollectionConfig,
    userId
  );

  const payloadToWrite = {
    ...customerPayload,
    aliases: eventPayload.type !== "TRANSFER" ? eventPayload.aliases : eventPayload.transferred_to,
  };

  await customersCollection.doc(userId).set(payloadToWrite, { merge: true });
  await customersCollection.doc(userId).update(payloadToWrite);
};

const setCustomClaims = async (
  auth: Auth,
  userId: string,
  entitlements: string[]
) => {
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
    const destinationUserIds =
      eventPayload.type === "TRANSFER"
        ? eventPayload.transferred_to
        : [eventPayload.app_user_id];

    const originUserIds =
      eventPayload.type === "TRANSFER" ? eventPayload.transferred_from : null;

    const eventType = (eventPayload.type || "").toLowerCase();

    if (EVENTS_COLLECTION) {
      const eventsCollection = firestore.collection(EVENTS_COLLECTION);
      await eventsCollection.doc(eventPayload.id).set(eventPayload);
    }

    if (CUSTOMERS_COLLECTION) {
      if (destinationUserIds) {
        destinationUserIds.forEach(async (userId) => {
          await writeToCollection(
            firestore,
            CUSTOMERS_COLLECTION,
            userId,
            customerPayload,
            eventPayload
          );
        });
      }

      if (originUserIds) {
        originUserIds.forEach(async (userId) => {
          const doc = getCustomersCollection(
            firestore,
            CUSTOMERS_COLLECTION,
            userId
          ).doc(userId);

          const deletePayload = [
            ...Object.keys(customerPayload),
            "aliases",
          ].reduce(
            (acc, key) => ({
              ...acc,
              [key]: firestoreCloud.FieldValue.delete(),
            }),
            {}
          );

          await doc.update(deletePayload);
        });
      }
    }

    if (SET_CUSTOM_CLAIMS === "ENABLED" && destinationUserIds) {
      const activeEntitlements = Object.keys(
        customerPayload.entitlements
      ).filter((entitlementID) => {
        const expiresDate =
          customerPayload.entitlements[entitlementID].expires_date;
        return expiresDate === null || moment.utc(expiresDate) >= moment.utc();
      });

      destinationUserIds.forEach(async (userId) => {
        await setCustomClaims(auth, userId, activeEntitlements);
      });

      if (originUserIds) {
        originUserIds.forEach(async (originUserId) => {
          await setCustomClaims(auth, originUserId, []);
        });
      }
    }

    await eventChannel?.publish({
      type: `com.revenuecat.v1.${eventType}`,
      data: eventPayload,
    });

    response.send({});
  } catch (err) {
    requestErrorHandler(err as Error, response);
  }
});
