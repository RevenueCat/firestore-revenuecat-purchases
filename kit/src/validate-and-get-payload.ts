import { logger } from "firebase-functions/logger";
import type { Request } from "firebase-functions/v2/https";
import * as nJwt from "njwt";
import { InvalidTokenError } from "./exceptions";

export const validateAndGetPayload =
  (sharedSecret: string) =>
  (request: Request): object => {
    try {
      const verification = nJwt.verify(request.body.token, sharedSecret) as {
        body: { payload?: string };
      };

      if (!verification.body.payload) {
        throw new InvalidTokenError();
      }

      return JSON.parse(verification.body.payload);
    } catch (e) {
      logger.error("Error while verifying request", e);

      throw new InvalidTokenError();
    }
  };
