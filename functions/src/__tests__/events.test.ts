import { createJWT, EXPECTED_AUTH_ERROR, getMockedRequest, getMockedResponse } from "./utils";
import * as api from "../index";
import * as admin from "firebase-admin";

describe("events", () => {
    afterEach(() => {
        // @ts-ignore
        global.firebaseTest.cleanup();
    });

    it("saves the event in the configured collection", async () => {
        const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(200, {}) as any;
        const payload = { id: "uuid", foo: "bar" };
        const mockedRequest = getMockedRequest(createJWT(60, payload, "test_secret")) as any;

        api.handler(mockedRequest, mockedResponse);

        setTimeout(async () => {
            const doc = await admin.firestore().collection("revenuecat_events").doc("uuid").get();
            expect(doc.data()).toEqual(payload);
        }, 500);
    });
});