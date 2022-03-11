import { ExtensionError, UnknownError } from "./exceptions";
import { logger, Response } from "firebase-functions";

interface ErrorPayload {
  error: {
    code: number;
    message: string;
  };
}

const constructResponsePayload = (exception: ExtensionError): ErrorPayload => {
  return {
    error: {
      code: exception.code(),
      message: exception.message,
    },
  };
};

const sendErrorResponse = async (
  httpStatus: number,
  response: Response,
  payload: Object
) => {
  return response.status(httpStatus).send(JSON.stringify(payload));
};

export const requestErrorHandler = (exception: Error, response: Response) => {
  let extensionException: ExtensionError;

  logger.error(exception, { structuredData: true });

  if (exception instanceof ExtensionError) {
    extensionException = exception;
  } else {
    extensionException = new UnknownError();
  }

  const responsePayload = constructResponsePayload(extensionException);

  return sendErrorResponse(
    extensionException.httpStatusCode(),
    response,
    responsePayload
  );
};
