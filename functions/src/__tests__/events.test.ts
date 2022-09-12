import { createJWT, getMockedRequest, getMockedResponse } from "./utils";
import * as api from "../index";
import * as admin from "firebase-admin";
import moment from "moment";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("events", () => {
  // @ts-ignore
  beforeAll(() => global.firebaseTest.cleanup());

  afterEach(() => {
    // @ts-ignore
    global.firebaseTest.cleanup();
  });

  beforeEach(async () => {
    await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("chairman_carranza")
      .delete();
  });

  const validPayload = {
    api_version: "0.0.2",
    event: {
      id: "uuid",
      app_user_id: "chairman_carranza",
      bar: "baz",
      aliases: ["miguelcarranza", "chairman_carranza"],
    },
    customer_info: {
      original_app_user_id: "miguelcarranza",
      first_seen: "2022-01-01 15:03",
      subscriptions: {
        pro: {
          purchase_date: moment.utc().subtract("days", 28).format(),
          expires_date: moment.utc().add("days", 2).format(),
          period_type: "normal",
          original_purchase_date: moment.utc().subtract("days", 28).format(),
          store: "app_store",
          is_sandbox: true,
          unsubscribe_detected_at: null,
          billing_issues_detected_at: null,
          grace_period_expires_date: null,
          ownership_type: "PURCHASED",
        },
        expired: {
          purchase_date: moment.utc().subtract("days", 32).format(),
          expires_date: moment.utc().subtract("days", 2).format(),
          period_type: "normal",
          original_purchase_date: moment.utc().subtract("days", 32).format(),
          store: "app_store",
          is_sandbox: true,
          unsubscribe_detected_at: moment.utc().subtract("days", 5).format(),
          billing_issues_detected_at: null,
          grace_period_expires_date: null,
          ownership_type: "PURCHASED",
        },
        lifetime: {
          purchase_date: moment.utc().subtract("days", 32).format(),
          expires_date: null,
          period_type: "normal",
          original_purchase_date: moment.utc().subtract("days", 32).format(),
          store: "app_store",
          is_sandbox: true,
          unsubscribe_detected_at: null,
          billing_issues_detected_at: null,
          grace_period_expires_date: null,
          ownership_type: "PURCHASED",
        },
      },
      entitlements: {
        pro: {
          expires_date: moment.utc().add("days", 2).format(),
        },
        expired: {
          expires_date: moment.utc().subtract("days", 2).format(),
        },
        lifetime: {
          expires_date: null,
        },
      },
    },
  };

  it("API returns extension version in headers", async () => {
    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(60, validPayload, "test_secret")
    ) as any;
    await api.handler(mockedRequest, mockedResponse);

    expect(mockedResponse.getHeaders()).toEqual({
      "X-EXTENSION-VERSION": validPayload.api_version,
    });
  });

  it("saves the event in the configured events collection", async () => {
    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;

    const mockedRequest = getMockedRequest(
      createJWT(60, validPayload, "test_secret")
    ) as any;

    api.handler(mockedRequest, mockedResponse);

    await sleep(300);

    const doc = await admin
      .firestore()
      .collection("revenuecat_events")
      .doc("uuid")
      .get();
    expect(doc.data()).toEqual(validPayload.event);
  });

  it("doesn't save the event if the REVENUECAT_EVENTS_COLLECTION setting is not set", async () => {
    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      REVENUECAT_EVENTS_COLLECTION: "",
    };

    const { handler } = require("../index");

    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(
        60,
        {
          ...validPayload,
          event: { ...validPayload.event, id: "not_save_this" },
        },
        "test_secret"
      )
    ) as any;

    handler(mockedRequest, mockedResponse);

    await sleep(300);

    const doc = await admin
      .firestore()
      .collection("revenuecat_events")
      .doc("not_save_this")
      .get();
    expect(doc.data()).toEqual(undefined);

    process.env = originalProcessEnv;
  });

  it("saves the customer_info in the customer collection", async () => {
    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(60, validPayload, "test_secret")
    ) as any;

    api.handler(mockedRequest, mockedResponse);

    await sleep(500);

    const doc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("chairman_carranza")
      .get();
    expect(doc.data()).toEqual({
      ...validPayload.customer_info,
      aliases: ["miguelcarranza", "chairman_carranza"],
    });

    const additionalCustomerInfo = {
      original_app_user_id: "chairman_carranza",
      another_field: "baz",
    };

    const otherMockedRequest = getMockedRequest(
      createJWT(
        60,
        {
          ...validPayload,
          customer_info: {
            ...validPayload.customer_info,
            ...additionalCustomerInfo,
          },
        },
        "test_secret"
      )
    ) as any;

    api.handler(otherMockedRequest, mockedResponse);

    await sleep(500);

    const updatedDoc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("chairman_carranza")
      .get();
    expect(updatedDoc.data()).toEqual({
      ...validPayload.customer_info,
      ...additionalCustomerInfo,
      aliases: ["miguelcarranza", "chairman_carranza"],
    });
  });

  it("removes entitlements/subscriptions from the customer collection", async () => {
    const initialPayload = {
      ...validPayload,
      customer_info: {
        ...validPayload.customer_info,
        subscriptions: {
          ...validPayload.customer_info.subscriptions,
          promotional: {
            purchase_date: moment.utc().subtract("days", 28).format(),
            expires_date: moment.utc().add("days", 2).format(),
            period_type: "normal",
            original_purchase_date: moment.utc().subtract("days", 28).format(),
            store: "promotional",
            is_sandbox: false,
            unsubscribe_detected_at: null,
            billing_issues_detected_at: null,
            grace_period_expires_date: null,
          },
        },
        entitlements: {
          ...validPayload.customer_info.entitlements,
          promotional: {
            expires_date: moment.utc().add("days", 4).format(),
          },
        },
      },
    };

    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(60, initialPayload, "test_secret")
    ) as any;

    api.handler(mockedRequest, mockedResponse);

    await sleep(500);

    const doc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("chairman_carranza")
      .get();

    expect(doc.data()).toEqual({
      ...initialPayload.customer_info,
      aliases: ["miguelcarranza", "chairman_carranza"],
    });

    const otherMockedRequest = getMockedRequest(
      createJWT(
        60,
        // When promotionals are removed, neither customer_info nor subscriptions will contain them anymore
        validPayload,
        "test_secret"
      )
    ) as any;

    api.handler(otherMockedRequest, mockedResponse);

    await sleep(500);

    const updatedDoc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("chairman_carranza")
      .get();

    expect(updatedDoc.data()).toEqual({
      ...validPayload.customer_info,
      aliases: ["miguelcarranza", "chairman_carranza"],
    });
  });

  it("updates the old record on a transfer event properly ", async () => {
    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;

    await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("jesus.sanchez")
      .set({
        email: "znk@revenuecat.com",
      });

    const mockedSetRequest = getMockedRequest(
      createJWT(60, validPayload, "test_secret")
    ) as any;

    api.handler(mockedSetRequest, mockedResponse);

    await sleep(100);

    const originCustomerInfo = {
      original_app_user_id: "chairman_carranza_original",
      first_seen: "2022-01-01 15:03",
      subscriptions: {
        anotherUnrelatedSubscription: {
          purchase_date: moment.utc().subtract("days", 32).format(),
          expires_date: null,
          period_type: "normal",
          original_purchase_date: moment.utc().subtract("days", 32).format(),
          store: "stripe",
          is_sandbox: false,
          unsubscribe_detected_at: null,
          billing_issues_detected_at: null,
          grace_period_expires_date: null,
          ownership_type: "PURCHASED",
        },
      },
      entitlements: {
        lifetime: {
          expires_date: null,
        },
      },
    };

    const mockedTransferRequest = getMockedRequest(
      createJWT(
        60,
        {
          ...validPayload,
          event: {
            ...validPayload.event,
            type: "TRANSFER",
            origin_app_user_id: "jesus.sanchez",
            transferred_from: ["jesus.sanchez", "znk"],
            transferred_to: validPayload.event.aliases,
          },
          origin_customer_info: originCustomerInfo,
        },
        "test_secret"
      )
    ) as any;

    api.handler(mockedTransferRequest, mockedResponse);

    await sleep(300);

    const oldUserDoc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("jesus.sanchez")
      .get();

    expect(oldUserDoc.data()).toEqual({
      email: "znk@revenuecat.com",
      aliases: ["jesus.sanchez", "znk"],
      ...originCustomerInfo,
    });

    const newUserDoc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc(validPayload.event.app_user_id)
      .get();

    expect(newUserDoc.data()).toEqual({
      ...validPayload.customer_info,
      aliases: validPayload.event.aliases,
    });
  });

  it("does not overwrite other keys of an existing collection", async () => {
    await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("chairman_carranza")
      .set({
        email: "chairman@revenuecat.com",
      });

    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;

    const mockedRequest = getMockedRequest(
      createJWT(60, validPayload, "test_secret")
    ) as any;

    api.handler(mockedRequest, mockedResponse);

    await sleep(300);

    const doc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("chairman_carranza")
      .get();

    expect(doc.data()).toEqual({
      ...validPayload.customer_info,
      email: "chairman@revenuecat.com",
      aliases: validPayload.event.aliases,
    });
  });

  it("handles ID placeholders in customer collection parameter", async () => {
    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      REVENUECAT_CUSTOMERS_COLLECTION: "users/{app_user_id}/revenuecat_info",
    };

    const { handler } = require("../index");

    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(60, validPayload, "test_secret")
    ) as any;

    handler(mockedRequest, mockedResponse);

    await sleep(500);

    const doc = await admin
      .firestore()
      .collection("users")
      .doc("chairman_carranza")
      .collection("revenuecat_info")
      .doc("chairman_carranza")
      .get();

    expect(doc.data()).toEqual({
      ...validPayload.customer_info,
      aliases: ["miguelcarranza", "chairman_carranza"],
    });

    process.env = originalProcessEnv;
  });

  it("doesn't save the event if the REVENUECAT_CUSTOMERS_COLLECTION setting is not set", async () => {
    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      REVENUECAT_CUSTOMERS_COLLECTION: "",
    };

    const { handler } = require("../index");

    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(
        60,
        {
          ...validPayload,
          event: {
            ...validPayload.event,
            app_user_id: "not_save_this",
          },
        },
        "test_secret"
      )
    ) as any;

    handler(mockedRequest, mockedResponse);

    await sleep(300);

    const doc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc("not_save_this")
      .get();
    expect(doc.data()).toEqual(undefined);

    process.env = originalProcessEnv;
  });

  it("doesn't save the event if the REVENUECAT_CUSTOMERS_COLLECTION setting without a userid", async () => {
    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      REVENUECAT_CUSTOMERS_COLLECTION: "customers",
    };

    const { handler } = require("../index");

    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(
        60,
        {
          ...validPayload,
          app_user_id: null,
          customer_info: {
            ...validPayload.customer_info,
            original_app_user_id: "not_save_this",
          },
        },
        "test_secret"
      )
    ) as any;

    handler(mockedRequest, mockedResponse);

    await sleep(300);

    const doc = await admin
      .firestore()
      .collection("customers")
      .doc("not_save_this")
      .get();
    expect(doc.data()).toEqual(undefined);

    process.env = originalProcessEnv;
  });

  it("set custom claims for user if SET_CUSTOM_CLAIMS is set", async () => {
    const testUserId = validPayload.event.app_user_id;

    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      SET_CUSTOM_CLAIMS: "ENABLED",
    };

    const { handler } = require("../index");

    const auth = admin.auth();

    const userImportRecords = [
      {
        uid: testUserId,
        email: "user1@example.com",
        passwordHash: Buffer.from("passwordHash1"),
        passwordSalt: Buffer.from("salt1"),
      },
      {
        uid: "leaveThisUserAlone",
        email: "user2@example.com",
        passwordHash: Buffer.from("passwordHash2"),
        passwordSalt: Buffer.from("salt2"),
      },
    ];

    await auth.importUsers(userImportRecords, {
      hash: {
        algorithm: "HMAC_SHA256",
        key: Buffer.from("secretKey"),
      },
    });

    await sleep(100);

    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(
        60,
        {
          ...validPayload,
          customer_info: {
            ...validPayload.customer_info,
            original_app_user_id: testUserId,
          },
        },
        "test_secret"
      )
    ) as any;

    handler(mockedRequest, mockedResponse);

    await sleep(500);

    const { customClaims } = await auth.getUser(testUserId);

    expect(customClaims).toEqual({
      revenueCatEntitlements: ["pro", "lifetime"],
    });

    const { customClaims: anotherCustomClaims } = await auth.getUser(
      "leaveThisUserAlone"
    );

    expect(anotherCustomClaims).toEqual(undefined);
    process.env = originalProcessEnv;
  });

  it("fails gracefully seting custom claims for user if SET_CUSTOM_CLAIMS is set but user doesn't exist", async () => {
    const testUserId = "francisco";

    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      SET_CUSTOM_CLAIMS: "ENABLED",
    };

    const { handler } = require("../index");

    const auth = admin.auth();

    const userImportRecords = [
      {
        uid: testUserId,
        email: "user1@example.com",
        passwordHash: Buffer.from("passwordHash1"),
        passwordSalt: Buffer.from("salt1"),
      },
    ];

    await auth.importUsers(userImportRecords, {
      hash: {
        algorithm: "HMAC_SHA256",
        key: Buffer.from("secretKey"),
      },
    });

    await sleep(100);

    const mockedResponse = getMockedResponse(expect, (resp) => {
      expect(resp).toEqual({});
    })(200, {}) as any;

    const mockedRequest = getMockedRequest(
      createJWT(
        60,
        {
          ...validPayload,
          customer_info: {
            ...validPayload.customer_info,
            original_app_user_id: "doesntExist",
          },
        },
        "test_secret"
      )
    ) as any;

    await handler(mockedRequest, mockedResponse);
    await sleep(500);
    process.env = originalProcessEnv;
  });
});
