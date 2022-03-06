import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { validateAndGetPayload } from "./validate-and-get-payload";
import * as dotenv from "dotenv";
import { validateApiVersion } from "./validate-api-version";
import { requestErrorHandler } from "./error-handler";
import path from "path";

const ENV_FILES_PATH = "../";
const ENV_FILE = path.join(ENV_FILES_PATH, process.env.NODE_ENV === "test" ? ".env.test" : ".env");

dotenv.config({
  path: ENV_FILE
});

admin.initializeApp();

const SHARED_SECRET = process.env.REVENUECAT_SHARED_SECRET as string;
const EVENTS_LOCATION = process.env.REVENUECAT_EVENTS_LOCATION as string;
const EXTENSION_VERSION = process.env.EXTENSION_VERSION as string;

interface BodyPayload {
  api_version: string;
  event: {
    id: string;
    subscriber_info: {}
  }
}

export const handler = functions.https.onRequest(async (request, response) => {
  try {
    const bodyPayload = validateAndGetPayload(SHARED_SECRET)(request) as BodyPayload;
    validateApiVersion(bodyPayload, EXTENSION_VERSION);

    const eventPayload = bodyPayload.event;

    const eventId = eventPayload.id;
    const firestore = admin.firestore();
    const collection = firestore.collection(EVENTS_LOCATION);

    await collection.doc(eventId).set(eventPayload);
    response.send({});
  } catch (err) {
    requestErrorHandler(err as Error, response);
  }
});
