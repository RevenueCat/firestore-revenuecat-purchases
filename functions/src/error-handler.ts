import { ExtensionError, InvalidApiVersionError, InvalidTokenError, UnknownError } from "./exceptions";
import { logger, Response } from "firebase-functions";

interface ErrorPayload {
    code: number,
    message: string
    extension_version?: string
}

const constructResponsePayload = (exception: ExtensionError, extensionVersion?: string): ErrorPayload => {
    return {
        code: exception.code(),
        message: exception.message,
        extension_version: extensionVersion,
    }
}

const sendErrorResponse = async (httpStatus: number, response: Response, payload: Object) => {
    return response.status(httpStatus).send(JSON.stringify(
        payload
    ));
}

export const requestErrorHandler = (exception: Error, response: Response, extensionVersion?: string) => {
    let responsePayload;
    let extensionException: ExtensionError;

    logger.error(exception, { structuredData: true} );

    if (exception instanceof ExtensionError) {
        extensionException = exception;
    } else {
        extensionException = new UnknownError();
    }

    responsePayload = constructResponsePayload(extensionException, extensionVersion)

    return sendErrorResponse(extensionException.httpStatusCode(), response, responsePayload);
};