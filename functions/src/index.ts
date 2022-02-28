import * as functions from "firebase-functions";
import { Request } from "firebase-functions/v1/https";
import * as admin from "firebase-admin";

import * as nJwt from "njwt";

admin.initializeApp();
// const auth = admin.auth();

const SHARED_SECRET = "carranza"; // TODO make Env variable
const ERROR_INVALID_SHARED_SECRET = "Invalid Shared Secret, please check your configuration {docs link}";


export const checkSignature = (sharedSecret: string) => (request: Request) => {
  const requestToken = request.get("x-revenuecat-token");

  if (!requestToken) {
    return false;
  }

  try {
    nJwt.verify(requestToken, sharedSecret);
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
