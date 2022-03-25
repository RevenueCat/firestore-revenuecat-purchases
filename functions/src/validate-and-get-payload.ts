import { logger } from "firebase-functions";
import { Request } from "firebase-functions/v1/https";
import * as nJwt from "njwt";
import { InvalidTokenError } from "./exceptions";

export const validateAndGetPayload = (sharedSecret: string) => (request: Request): Object | void => {
    try {
      const verification = nJwt.verify(request.body.token, sharedSecret) as { body: { payload?: string } };

      if (!verification.body.payload) {
        throw new InvalidTokenError();
      }
      
      return JSON.parse(verification.body.payload);      
    } catch(e) { 
      logger.error('Error while verifying request', e);

      throw new InvalidTokenError();
    }
  };