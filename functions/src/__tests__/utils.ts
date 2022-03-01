import nJwt, { JSONMap } from "njwt";

// TODO: add docs
export const EXPECTED_AUTH_ERROR = JSON.stringify({
    error: "Invalid Shared Secret, please check your configuration {docs link}"
});

export const createJWT = (expirationSeconds: number, payload: JSONMap, secretKey: string) => {
    var claims: JSONMap = {
        iss: "https://firebase-extension.revenuecat.com/",
        payload: payload
    }

    const jwt = nJwt.create(claims, secretKey);
    jwt.setExpiration(new Date().getTime() + (expirationSeconds * 1000));

    return jwt.compact();
}

export const getMockedResponse = (expect: any, onSend: (payload: Object) => void) => (expectedStatusCode: number, expectedResponse: Object) => {
    return {
        status: function (code: number) { 
            expect(code).toBe(expectedStatusCode);
            // @ts-ignore
            this.statusCode = code;
            return this;
        },
        send: function(payload: Object) {
            expect(payload).toEqual(expectedResponse);
            onSend(payload);
            return this;
        }
    }
}

export const getMockedRequest = (getters: any, payload: any) => {
    return {
        get: function (key: string) { 
            return getters[key];
        },
        body: payload
    }
}