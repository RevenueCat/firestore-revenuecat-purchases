import { logger } from "firebase-functions";
import { Request } from "firebase-functions/v1/https";
import * as nJwt from "njwt";
import { InvalidTokenError } from "./exceptions";

export const validateAndGetPayload = (sharedSecret: string) => (request: Request): Object | void => {
    try {
      logger.info(`Attempting to validate JWT: ${JSON.stringify(request.body)}`);

      const verification = nJwt.verify(request.body.token, sharedSecret) as { body: { payload?: string } };

      logger.info("JWT verified", verification);

      if (verification.body.payload) {
        const bodyPayload = JSON.parse(verification.body.payload);
        return bodyPayload;
      }
    } catch(e) { 
        logger.error('Error while verifying request', e);

        throw new InvalidTokenError();
    }
  };