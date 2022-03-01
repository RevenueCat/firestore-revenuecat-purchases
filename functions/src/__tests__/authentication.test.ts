import * as admin from "firebase-admin";
import { createJWT, EXPECTED_AUTH_ERROR, getMockedRequest, getMockedResponse } from "./utils";

describe("authentication", () => {
    let adminStub: any;
    let api: any;
  
    beforeAll(() => {
        adminStub = jest.spyOn(admin, "initializeApp");

        // after initializeApp call, we load our functions
        api = require("../index");
    });

    afterAll(() => {
        // clean things up
        adminStub.mockRestore();
        // @ts-ignore
        global.testEnv.cleanup();        
    });

    it("should authenticate with a valid JWT", (done) => {
        const mockedResponse = getMockedResponse(expect, () => done())(200, {});
        const payload = { foo: "bar" };
        const mockedRequest = getMockedRequest({
            "x-revenuecat-token": createJWT(60, payload, "test_secret"),
        }, payload);

        api.handler(mockedRequest, mockedResponse);
    });

    it("should not authenticate with an expired JWT", (done) => {
        const expectedReponse = EXPECTED_AUTH_ERROR;

        const mockedResponse = getMockedResponse(expect, () => done())(401, expectedReponse);
        const payload = { foo: "bar" };
        const mockedRequest = getMockedRequest({
            "x-revenuecat-token": createJWT(-60, payload, "test_secret"),
        }, payload);

        api.handler(mockedRequest, mockedResponse);
    });

    it("should not authenticate with an invalid secret", (done) => {
        const expectedReponse = EXPECTED_AUTH_ERROR;

        const mockedResponse = getMockedResponse(expect, () => done())(401, expectedReponse);
        const payload = { foo: "bar" };
        const mockedRequest = getMockedRequest({
            "x-revenuecat-token": createJWT(60, payload, "invalid_secret"),
        }, payload);

        api.handler(mockedRequest, mockedResponse);
    });    

    it("should not authenticate without a valid header", (done) => {
        const expectedReponse = EXPECTED_AUTH_ERROR;

        const mockedResponse = getMockedResponse(expect, () => done())(401, expectedReponse);
        const payload = { foo: "bar" };
        const mockedRequest = getMockedRequest({}, payload);

        api.handler(mockedRequest, mockedResponse);
    });    

    it("should not authenticate with an invalid payload", (done) => {
        const mockedResponse = getMockedResponse(expect, () => done())(401, EXPECTED_AUTH_ERROR);
        const payload = { foo: "bar" };
        const mockedRequest = getMockedRequest({
            "x-revenuecat-token": createJWT(60, payload, "test_secret"),
        }, { foo: "bar injected"});

        api.handler(mockedRequest, mockedResponse);
    });
});