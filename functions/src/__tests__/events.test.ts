import { createJWT, getMockedRequest, getMockedResponse } from "./utils";
import * as api from "../index";
import * as admin from "firebase-admin";

describe("events", () => {
    // @ts-ignore
    beforeAll(() => global.firebaseTest.cleanup());

    afterEach(() => {
        // @ts-ignore
        global.firebaseTest.cleanup();
    });

    it("saves the event in the configured collection", (done) => {
        const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(200, {}) as any;
        const payload = { api_version: "1.0.0", event: { id: "uuid", bar: "baz" }};
        const mockedRequest = getMockedRequest(createJWT(60, payload, "test_secret")) as any;

        api.handler(mockedRequest, mockedResponse);

        setTimeout(async () => {
            const doc = await admin.firestore().collection("revenuecat_events").doc("uuid").get();
            expect(doc.data()).toEqual(payload.event);
            done();
        }, 500);
    });
});