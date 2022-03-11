export abstract class ExtensionError extends Error {
  abstract code(): number;
  abstract httpStatusCode(): number;
}

export class InvalidTokenError extends ExtensionError {
  constructor() {
    super(
      "Incoming RevenueCat webhook could not be authenticated. Please check that the shared secret is set up correctly."
    );
  }

  code() {
    return 1;
  }

  httpStatusCode() {
    return 401;
  }
}

export class InvalidApiVersionError extends ExtensionError {
  constructor(extensionVersion: string, apiVersion: string) {
    const apiVersionDisplay = apiVersion ?? "(Not specified)";

    const message = `The version of this extension is not the same. Extension version ${extensionVersion}, Api version: ${apiVersionDisplay}. Please retry the request with the correct version`;
    super(message);
  }

  code() {
    return 2;
  }

  httpStatusCode() {
    return 400;
  }
}

export class UnknownError extends ExtensionError {
  constructor() {
    const message = `Unknown error, please contact us a https://support.revenuecat.com/`;
    super(message);
  }

  code() {
    return 3;
  }

  httpStatusCode() {
    return 500;
  }
}
