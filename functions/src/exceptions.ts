export abstract class ExtensionError extends Error {
    abstract code(): number;
}

export class InvalidTokenError extends ExtensionError {
    constructor() {
        super("Incoming RevenueCat webhook could not be authenticated. Please check that the shared secret is set up correctly.");
    }

    code() {
        return 1;
    }
}

export class InvalidApiVersionError extends ExtensionError {
    constructor(extensionVersion: string, apiVersion: string) {
        const apiVersionDisplay = apiVersion ?? "(Not specified)";

        const message = `The version of this extension is not the same. Extension version ${extensionVersion}, Api version: ${apiVersionDisplay}. Please retry the request with the correct version`
        super(message);

        Object.setPrototypeOf(this, InvalidApiVersionError.prototype);
    }

    code() {
        return 2;
    }
}

export class UnknownError extends ExtensionError {
    constructor() {
        const message = `Unknown error, please contact us a https://support.revenuecat.com/`
        super(message);

        Object.setPrototypeOf(this, InvalidApiVersionError.prototype);
    }

    code() {
        return 3;
    }
}