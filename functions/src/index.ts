import * as functions from "firebase-functions";
import { Request } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import equal from "fast-deep-equal";

import * as nJwt from "njwt";
import { ERROR_INVALID_SHARED_SECRET } from "./errors";

admin.initializeApp();

const SHARED_SECRET = process.env.REVENUECAT_SHARED_SECRET as string;
const EVENTS_LOCATION = process.env.REVENUECAT_EVENTS_LOCATION as string;

export const checkSignature = (sharedSecret: string) => (request: Request) => {
  const requestToken = request.get("x-revenuecat-token");

  if (!requestToken) {
    return false;
  }

  try {
    const verification = nJwt.verify(requestToken, sharedSecret) as { body: { payload?: Object } };

    if (!verification.body.payload || !equal(verification.body.payload, request.body)) {
      return false;
    }

  } catch(e) {
      logMessage(ERROR_INVALID_SHARED_SECRET, "error");

      return false;
  }
  return true;
};

const logMessage = (message: string | {message: string, code: number}, level: "info" | "error" ="info") => {
    functions.logger[level](message, { structuredData: true });
}

export const handler = functions.https.onRequest(async (request, response) => {
  if (!checkSignature(SHARED_SECRET)(request)) {
    response.status(401).send(JSON.stringify({
        error: ERROR_INVALID_SHARED_SECRET,
    }));

    return Promise.resolve();
  }

  const eventPayload = request.body; // TODO: to not break this for phase 3, let's add this under request.body.event
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
