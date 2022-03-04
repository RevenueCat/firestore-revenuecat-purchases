import * as functions from "firebase-functions";
import { Request } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import equal from "fast-deep-equal";

import * as nJwt from "njwt";
import { ERROR_INVALID_SHARED_SECRET } from "./errors";

admin.initializeApp();

const SHARED_SECRET = process.env.REVENUECAT_SHARED_SECRET as string;
const EVENTS_LOCATION = process.env.REVENUECAT_EVENTS_LOCATION as string;

export const validateAndGetPayload = (sharedSecret: string) => (request: Request) => {
  try {
    console.log("FOO", sharedSecret, request.body);
    const verification = nJwt.verify(request.body, sharedSecret) as { body: { payload?: Object } };
    return verification.body.payload;
  } catch(e) { 
      logMessage(ERROR_INVALID_SHARED_SECRET, "error");
      logMessage(e as string);

      return false;
  }
};

const logMessage = (message: string | {message: string, code: number}, level: "info" | "error" ="info") => {
    functions.logger[level](message, { structuredData: true });
}

export const handler = functions.https.onRequest(async (request, response) => {
  // TODO: validate DTO
  const eventPayload = validateAndGetPayload(SHARED_SECRET)(request) as { id: string };

  if (!eventPayload) {
    response.status(401).send(JSON.stringify({
        error: ERROR_INVALID_SHARED_SECRET,
    }));

    return Promise.resolve();
  }

  const eventId = eventPayload.id;
  
  const firestore = admin.firestore();
  const collection = firestore.collection(EVENTS_LOCATION);
  
  try {
    await collection.doc(eventId).set(eventPayload);
  } catch (e) {
    logMessage(`Error saving to document: ${e}`, "error");
  }

  response.send({});
});
