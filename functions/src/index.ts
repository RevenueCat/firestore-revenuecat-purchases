import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { validateAndGetPayload } from "./validate-and-get-payload";
import { validateApiVersion } from "./validate-api-version";
import { requestErrorHandler } from "./error-handler";
admin.initializeApp();

const SHARED_SECRET = process.env.REVENUECAT_SHARED_SECRET as string;
const EVENTS_COLLECTION = process.env.REVENUECAT_EVENTS_COLLECTION as string | undefined;
const CUSTOMERS_COLLECTION = process.env.REVENUECAT_CUSTOMERS_COLLECTION as string | undefined;
const EXTENSION_VERSION = process.env.EXTENSION_VERSION || "1.0.0";

interface BodyPayload {
  api_version: string;
  event: {
    id: string;
    subscriber_info: {}
  },
  customer_info: {
    original_app_user_id: string;
  }
}

export const handler = functions.https.onRequest(async (request, response) => {
  try {
    response.header("X-EXTENSION-VERSION", EXTENSION_VERSION);

    const bodyPayload = validateAndGetPayload(SHARED_SECRET)(request) as BodyPayload;
    validateApiVersion(bodyPayload, EXTENSION_VERSION);

    const firestore = admin.firestore();

    let eventsSet = null;
    let customersSet = null;

    if (EVENTS_COLLECTION) {
      const eventPayload = bodyPayload.event;
      const eventsCollection = firestore.collection(EVENTS_COLLECTION);
      eventsSet = eventsCollection.doc(eventPayload.id).set(eventPayload);
    }

    if (CUSTOMERS_COLLECTION) {
      const customerPayload = bodyPayload.customer_info;
      const customersCollection = firestore.collection(CUSTOMERS_COLLECTION);
      customersSet = customersCollection.doc(customerPayload.original_app_user_id).set(customerPayload, { merge: true});
    }

    await Promise.all([
      ...eventsSet ? [eventsSet] : [],
      ...customersSet ? [customersSet] : []
    ])

    response.send({});
  } catch (err) {
    requestErrorHandler(err as Error, response);
  }
});
