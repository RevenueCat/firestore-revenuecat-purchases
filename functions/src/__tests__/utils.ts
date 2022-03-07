import nJwt, { JSONMap } from "njwt";

// TODO: add docs
export const EXPECTED_AUTH_ERROR = JSON.stringify({
    error: { code:1 , message: "Incoming RevenueCat webhook could not be authenticated. Please check that the shared secret is set up correctly."}
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

export const getMockedRequest = (payload: any) => {
    return {
        body: payload
    }
}