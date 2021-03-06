import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { validateAndGetPayload } from "./validate-and-get-payload";
import { validateApiVersion } from "./validate-api-version";
import { requestErrorHandler } from "./error-handler";
import moment from "moment";
import { logMessage } from "./log-message";

import { getEventarc } from "firebase-admin/eventarc";

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
const EXTENSION_VERSION = process.env.EXTENSION_VERSION || "0.1.1";

interface Entitlement {
  expires_date: string;
  purchase_date: string;
  product_identifier: string;
  grace_period_expires_date: string;
}

interface BodyPayload {
  api_version: string;
  event: {
    id: string;
    app_user_id: string;
    subscriber_info: {};
    aliases: string[];
    type: string;
  };
  customer_info: {
    original_app_user_id: string;
    entitlements: { [entitlementIdentifier: string]: Entitlement };
  };
}

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
    const userId = eventPayload.app_user_id;
    const eventType = (eventPayload.type || "").toLowerCase();

    if (EVENTS_COLLECTION) {
      const eventsCollection = firestore.collection(EVENTS_COLLECTION);
      await eventsCollection.doc(eventPayload.id).set(eventPayload);
    }

    if (CUSTOMERS_COLLECTION && userId) {
      const customersCollection = firestore.collection(CUSTOMERS_COLLECTION);
      await customersCollection.doc(userId).set(
        {
          ...customerPayload,
          aliases: eventPayload.aliases,
        },
        { merge: true }
      );
    }

    if (SET_CUSTOM_CLAIMS === "ENABLED" && userId) {
      const activeEntitlements = Object.keys(
        customerPayload.entitlements
      ).filter((entitlementID) => {
        const expiresDate =
          customerPayload.entitlements[entitlementID].expires_date;
        return expiresDate === null || moment.utc(expiresDate) >= moment.utc();
      });

      try {
        const { customClaims } = await auth.getUser(userId);
        await admin.auth().setCustomUserClaims(userId, {
          ...(customClaims ? customClaims : {}),
          revenueCatEntitlements: activeEntitlements,
        });
      } catch (userError) {
        logMessage(`Error saving user ${userId}: ${userError}`, "error");
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
