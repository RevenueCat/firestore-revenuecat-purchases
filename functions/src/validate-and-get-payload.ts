import { Request } from "firebase-functions/v1/https";
import * as nJwt from "njwt";
import { InvalidTokenError } from "./exceptions";

export const validateAndGetPayload = (sharedSecret: string) => (request: Request): Object | void => {
    try {
      const verification = nJwt.verify(request.body, sharedSecret) as { body: { payload?: Object } };
      const bodyPayload = verification.body.payload;

      return bodyPayload;
    } catch(e) { 
        throw new InvalidTokenError();
    }
  };