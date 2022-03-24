import nJwt, { JSONMap } from "njwt";

// TODO: add docs
export const EXPECTED_AUTH_ERROR = JSON.stringify({
    code:1,
    message: "Incoming RevenueCat webhook could not be authenticated. Please check that the shared secret is set up correctly."
});

export const createJWT = (expirationSeconds: number, payload: JSONMap, secretKey: string) => {
    var claims: JSONMap = {
        iss: "https://firebase-extension.revenuecat.com/",
        payload: JSON.stringify(payload)
    }

    const jwt = nJwt.create(claims, secretKey);
    jwt.setExpiration(new Date().getTime() + (expirationSeconds * 1000));

    return jwt.compact();
}

type OnSend = (payload: Object) => void;
type MockedResponseCallable = (expectedStatusCode: number, expectedResponse: Object) => any;

export function getMockedResponse(expect: any, onSend: OnSend): MockedResponseCallable { 
    return (expectedStatusCode, expectedResponse) => ({
        header: function(headerKey: string, headerValue: string) {
            if (!this.headers) {
                this.headers = {};
            }

            this.headers[headerKey] = headerValue;
        },
        getHeaders: function() {
            return this.headers;
        },
        status: function (code: number) { 
            expect(code).toBe(expectedStatusCode);
            // @ts-ignore
            this.statusCode = code;
            return this;
        },
        send: function (payload: Object) {
            expect(payload).toEqual(expectedResponse);
            onSend(payload);
            return this;
        }
    });
}

export const getMockedRequest = (payload: any) => {
    return {
        body: {
            token: payload
        }
    }
}