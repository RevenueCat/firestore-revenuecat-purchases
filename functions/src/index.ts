import * as functions from "firebase-functions";
import { Request } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";
import equal from "fast-deep-equal";

import * as nJwt from "njwt";

admin.initializeApp();
// const auth = admin.auth();

const SHARED_SECRET = process.env.REVENUECAT_SHARED_SECRET as string;
const ERROR_INVALID_SHARED_SECRET = "Invalid Shared Secret, please check your configuration {docs link}";

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

const logMessage = (message: string, level: "info" | "error" ="info") => {
    functions.logger[level](message, { structuredData: true });
}

export const handler = functions.https.onRequest((request, response) => {
  
  if (!checkSignature(SHARED_SECRET)(request)) {
    response.status(401).send(JSON.stringify({
        error: ERROR_INVALID_SHARED_SECRET,
    }));

    return;
  }

  response.send({});
});
