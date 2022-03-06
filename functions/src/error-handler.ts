import { ExtensionError, InvalidApiVersionError, InvalidTokenError, UnknownError } from "./exceptions";
import { Response }from "firebase-functions";

interface ErrorPayload {
    error: {
        code: number,
        message: string
    }
}

const constructResponsePayload = (exception: ExtensionError): ErrorPayload => {
    return {
        error: {
            code: exception.code(),
            message: exception.message
        }
    }
}

const sendErrorResponse = async (httpStatus: number, response: Response, payload: Object) => {
    return response.status(httpStatus).send(JSON.stringify(
        payload
    ));
}

export const requestErrorHandler = (exception: Error, response: Response) => {
    let responsePayload;
    let extensionException: ExtensionError;

    if (exception instanceof ExtensionError) {
        extensionException = exception;
    } else {
        extensionException = new UnknownError();
    }

    responsePayload = constructResponsePayload(extensionException)

    switch (true) {
        case exception instanceof InvalidApiVersionError:
            return sendErrorResponse(400, response, responsePayload);
        case exception instanceof InvalidTokenError:
            return sendErrorResponse(401, response, responsePayload);        
        default:
            return sendErrorResponse(500, response, responsePayload);
    }
  };