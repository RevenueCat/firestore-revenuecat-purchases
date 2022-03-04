import { createJWT, EXPECTED_AUTH_ERROR, getMockedRequest, getMockedResponse } from "./utils";
import * as api from "../index";


describe("authentication", () => {
    afterEach(() => {
        // @ts-ignore
        global.firebaseTest.cleanup();
    });

    it("should authenticate with a valid JWT", (done) => {
        const mockedResponse = getMockedResponse(expect, () => done())(200, {}) as any;
        const payload = { id: "uuid", foo: "bar" };
        const mockedRequest = getMockedRequest(createJWT(60, payload, "test_secret")) as any;

        api.handler(mockedRequest, mockedResponse);
    });

    it("should not authenticate with an expired JWT", (done) => {
        const expectedReponse = EXPECTED_AUTH_ERROR;

        const mockedResponse = getMockedResponse(expect, () => done())(401, expectedReponse) as any;
        const payload = { foo: "bar" };
        const mockedRequest = getMockedRequest(createJWT(-60, payload, "test_secret")) as any;

        api.handler(mockedRequest, mockedResponse);
    });

    it("should not authenticate with an invalid secret", (done) => {
        const expectedReponse = EXPECTED_AUTH_ERROR;

        const mockedResponse = getMockedResponse(expect, () => done())(401, expectedReponse) as any;
        const payload = { foo: "bar" };
        const mockedRequest = getMockedRequest(createJWT(60, payload, "invalid_secret")) as any;

        api.handler(mockedRequest, mockedResponse);
    });    

    it("should not authenticate with an invalid payload", (done) => {
        const mockedResponse = getMockedResponse(expect, () => done())(401, EXPECTED_AUTH_ERROR) as any;
        const payload = { foo: "bar" };
        const validJWT = createJWT(60, payload, "test_secret");

        const [header, _jwtPayload, signature] = validJWT.split(".");

        const extractedJwt = JSON.parse(Buffer.from(_jwtPayload, "base64").toString("ascii"));

        const craftedPayload = Buffer.from(JSON.stringify({
            ...extractedJwt,
            payload: {
                ...extractedJwt.payload,
                foo: "baz"
            }
        })).toString("base64");

        const craftedJwt = [header, craftedPayload, signature].join(".");

        const mockedRequest = getMockedRequest(craftedJwt) as any;

        api.handler(mockedRequest, mockedResponse);
    });
});