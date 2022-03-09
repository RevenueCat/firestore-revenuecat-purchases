import { createJWT, getMockedRequest, getMockedResponse } from "./utils";
import * as api from "../index";
import * as admin from "firebase-admin";

function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("events", () => {
    // @ts-ignore
    beforeAll(() => global.firebaseTest.cleanup());

    afterEach(() => {
        // @ts-ignore
        global.firebaseTest.cleanup();
    });

    const validPayload = { api_version: "1.0.0", event: { id: "uuid", bar: "baz" }, customer_info: { original_app_user_id: "miguelcarranza", first_seen: "2022-01-01 15:03" } };

    it("API returns extension version in headers", async () => {
        const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(200, {}) as any;
        const mockedRequest = getMockedRequest(createJWT(60, validPayload, "test_secret")) as any;
        await api.handler(mockedRequest, mockedResponse);

        expect(mockedResponse.getHeaders()).toEqual({ 'X-EXTENSION-VERSION': validPayload.api_version });
    });

    it("saves the event in the configured events collection", (done) => {
        const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(200, {}) as any;
        
        const mockedRequest = getMockedRequest(createJWT(60, validPayload, "test_secret")) as any;

        api.handler(mockedRequest, mockedResponse);

        setTimeout(async () => {
            const doc = await admin.firestore().collection("revenuecat_events").doc("uuid").get();
            expect(doc.data()).toEqual(validPayload.event);
            done();
        }, 500);
    });

    it("saves the customer_info in the customer collection", async () => {
        const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(200, {}) as any;

        const mockedRequest = getMockedRequest(createJWT(60, validPayload, "test_secret")) as any;

        api.handler(mockedRequest, mockedResponse);

        await timeout(300);

        const doc = await admin.firestore().collection("revenuecat_customers").doc("miguelcarranza").get();
        expect(doc.data()).toEqual(validPayload.customer_info);

        const additionalCustomerInfo = { original_app_user_id: "miguelcarranza", another_field: "baz" };

        const otherMockedRequest = getMockedRequest(createJWT(60, {...validPayload, customer_info: additionalCustomerInfo }, "test_secret")) as any;

        api.handler(otherMockedRequest, mockedResponse);

        await timeout(300);

        const updatedDoc = await admin.firestore().collection("revenuecat_customers").doc("miguelcarranza").get();
        expect(updatedDoc.data()).toEqual({...validPayload.customer_info, ...additionalCustomerInfo });
    });
});