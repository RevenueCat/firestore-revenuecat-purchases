import { InvalidApiVersionError } from "./exceptions"

export const validateApiVersion = (payload: any, extensionVersion: string): void => {
    if (!payload.api_version || payload.api_version !== extensionVersion) {
        throw new InvalidApiVersionError(extensionVersion, payload.api_version);
    }
}