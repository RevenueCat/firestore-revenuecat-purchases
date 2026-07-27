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

  // The handler applies an event id only once, so every delivery in the suite
  // needs its own id, including across test files: authentication.test.ts
  // delivers "uuid" and jest runs test files in parallel workers.
  const EVENT_TIMESTAMP_MS = 1700000000000;

  const validPayload = {
    api_version: "0.0.2",
    event: {
      id: "events_base",
      event_timestamp_ms: EVENT_TIMESTAMP_MS,
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

  const payloadWithEventId = (id: string) => ({
    ...validPayload,
    event: { ...validPayload.event, id },
  });

  const activeEntitlements = {
    pro: {
      expires_date: moment.utc().add("days", 2).format(),
    },
  };

  const transferPayload = ({
    id,
    eventTimestampMs,
    destinationUserId,
    destinationEntitlements,
    originUserId,
    originEntitlements,
  }: {
    id: string;
    eventTimestampMs: number;
    destinationUserId: string;
    destinationEntitlements: Record<string, { expires_date: string | null }>;
    originUserId: string;
    originEntitlements: Record<string, { expires_date: string | null }>;
  }) => ({
    api_version: validPayload.api_version,
    event: {
      id,
      event_timestamp_ms: eventTimestampMs,
      type: "TRANSFER",
      app_user_id: destinationUserId,
      aliases: [destinationUserId],
      origin_app_user_id: originUserId,
      transferred_from: [originUserId],
      transferred_to: [destinationUserId],
    },
    customer_info: {
      original_app_user_id: destinationUserId,
      entitlements: destinationEntitlements,
    },
    origin_customer_info: {
      original_app_user_id: originUserId,
      entitlements: originEntitlements,
    },
  });

  const deliver = async (payload: Object, handlerFn = api.handler) => {
    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(60, payload as any, "test_secret")
    ) as any;

    await handlerFn(mockedRequest, mockedResponse);
  };

  const customerDoc = (userId: string) =>
    admin.firestore().collection("revenuecat_customers").doc(userId).get();

  const eventDoc = (eventId: string) =>
    admin.firestore().collection("revenuecat_events").doc(eventId).get();

  it("API returns extension version in headers", async () => {
    const mockedResponse = getMockedResponse(expect, () => Promise.resolve())(
      200,
      {}
    ) as any;
    const mockedRequest = getMockedRequest(
      createJWT(60, payloadWithEventId("events_header"), "test_secret")
    ) as any;
    await api.handler(mockedRequest, mockedResponse);

    expect(mockedResponse.getHeaders()).toEqual({
      "X-EXTENSION-VERSION": validPayload.api_version,
    });
  });

  it("saves the event in the configured events collection", async () => {
    const payload = payloadWithEventId("events_saved");

    await deliver(payload);

    const doc = await eventDoc("events_saved");
    expect(doc.data()).toEqual({
      ...payload.event,
      rc_applied_at: expect.anything(),
    });
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
      createJWT(60, payloadWithEventId("not_save_this"), "test_secret")
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
      createJWT(60, payloadWithEventId("events_customer_info"), "test_secret")
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
      rc_last_event_timestamp_ms: EVENT_TIMESTAMP_MS,
    });

    const additionalCustomerInfo = {
      original_app_user_id: "chairman_carranza",
      another_field: "baz",
    };

    const otherMockedRequest = getMockedRequest(
      createJWT(
        60,
        {
          ...payloadWithEventId("events_customer_info_update"),
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
      rc_last_event_timestamp_ms: EVENT_TIMESTAMP_MS,
    });
  });

  it("removes entitlements/subscriptions from the customer collection", async () => {
    const initialPayload = {
      ...payloadWithEventId("events_promotional_added"),
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
      rc_last_event_timestamp_ms: EVENT_TIMESTAMP_MS,
    });

    const otherMockedRequest = getMockedRequest(
      createJWT(
        60,
        // When promotionals are removed, neither customer_info nor subscriptions will contain them anymore
        payloadWithEventId("events_promotional_removed"),
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
      rc_last_event_timestamp_ms: EVENT_TIMESTAMP_MS,
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
      createJWT(60, payloadWithEventId("events_transfer_setup"), "test_secret")
    ) as any;

    api.handler(mockedSetRequest, mockedResponse);

    await sleep(500);

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
            id: "uuid_transfer",
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
      rc_last_event_timestamp_ms: EVENT_TIMESTAMP_MS,
    });

    const newUserDoc = await admin
      .firestore()
      .collection("revenuecat_customers")
      .doc(validPayload.event.app_user_id)
      .get();

    expect(newUserDoc.data()).toEqual({
      ...validPayload.customer_info,
      aliases: validPayload.event.aliases,
      rc_last_event_timestamp_ms: EVENT_TIMESTAMP_MS,
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
      createJWT(60, payloadWithEventId("events_other_keys"), "test_secret")
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
      rc_last_event_timestamp_ms: EVENT_TIMESTAMP_MS,
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
      createJWT(60, payloadWithEventId("events_placeholder"), "test_secret")
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
      rc_last_event_timestamp_ms: EVENT_TIMESTAMP_MS,
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
            id: "events_no_customers_collection",
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
          ...payloadWithEventId("events_customers_collection_no_userid"),
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
          ...payloadWithEventId("events_custom_claims"),
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
      // `lifetime` never expires, so its expiry is null; `pro` carries its own.
      revenueCatEntitlementsExpiresAtMs: {
        pro: moment
          .utc(validPayload.customer_info.entitlements.pro.expires_date)
          .valueOf(),
        lifetime: null,
      },
      revenueCatEventTimestampMs: EVENT_TIMESTAMP_MS,
    });

    const { customClaims: anotherCustomClaims } = await auth.getUser(
      "leaveThisUserAlone"
    );

    expect(anotherCustomClaims).toEqual(undefined);
    process.env = originalProcessEnv;
  });

  describe("idempotency and ordering", () => {
  it("ignores a redelivery of an event that was already applied", async () => {
    await deliver({
      ...validPayload,
      event: { ...validPayload.event, id: "redelivered_event" },
    });

    await deliver({
      ...validPayload,
      event: { ...validPayload.event, id: "redelivered_event" },
      customer_info: {
        ...validPayload.customer_info,
        original_app_user_id: "someone_else",
      },
    });

    const doc = await customerDoc("chairman_carranza");
    expect(doc.get("original_app_user_id")).toEqual("miguelcarranza");
  });

  it("applies an event whose document exists but was never marked as applied", async () => {
    await admin
      .firestore()
      .collection("revenuecat_events")
      .doc("interrupted_event")
      .set({ id: "interrupted_event" });

    await deliver({
      ...validPayload,
      event: { ...validPayload.event, id: "interrupted_event" },
    });

    const doc = await customerDoc("chairman_carranza");
    expect(doc.get("original_app_user_id")).toEqual("miguelcarranza");

    const event = await eventDoc("interrupted_event");
    expect(event.get("app_user_id")).toEqual("chairman_carranza");
    expect(event.get("rc_applied_at")).toEqual(expect.anything());
  });

  it("finishes a retry that reuses the timestamp it already wrote", async () => {
    const event = { ...validPayload.event, id: "retried_event" };

    await deliver({ ...validPayload, event });

    // A delivery that died before marking the event leaves the watermark equal
    // to its own timestamp; the retry has to get past it.
    await eventDoc("retried_event").then((doc) => doc.ref.set(event));
    await customerDoc("chairman_carranza").then((doc) =>
      doc.ref.update({ entitlements: {} })
    );

    await deliver({ ...validPayload, event });

    const doc = await customerDoc("chairman_carranza");
    expect(doc.get("entitlements")).toEqual(
      validPayload.customer_info.entitlements
    );
  });

  it("applies a newer event over an older one", async () => {
    await deliver({
      ...validPayload,
      event: { ...validPayload.event, id: "watermark_first" },
    });

    await deliver({
      ...validPayload,
      event: {
        ...validPayload.event,
        id: "watermark_second",
        event_timestamp_ms: EVENT_TIMESTAMP_MS + 1,
      },
      customer_info: { ...validPayload.customer_info, entitlements: {} },
    });

    const doc = await customerDoc("chairman_carranza");
    expect(doc.get("entitlements")).toEqual({});
    expect(doc.get("rc_last_event_timestamp_ms")).toEqual(
      EVENT_TIMESTAMP_MS + 1
    );
  });

  it("does not write a watermark for events without event_timestamp_ms", async () => {
    const { event_timestamp_ms, ...eventWithoutTimestamp } = validPayload.event;

    await deliver({
      ...validPayload,
      event: { ...eventWithoutTimestamp, id: "no_timestamp_event" },
    });

    const doc = await customerDoc("chairman_carranza");
    expect(doc.data()).toEqual({
      ...validPayload.customer_info,
      aliases: validPayload.event.aliases,
    });
  });

  it("ignores a transfer that is older than the last event applied to the customer", async () => {
    // B -> C is applied first and revokes B.
    await deliver(
      transferPayload({
        id: "transfer_b_to_c",
        eventTimestampMs: 2000,
        destinationUserId: "owner_c",
        destinationEntitlements: activeEntitlements,
        originUserId: "owner_b",
        originEntitlements: {},
      })
    );

    // A -> B arrives afterwards carrying a snapshot from before the B -> C
    // transfer, in which B still owned the entitlement.
    await deliver(
      transferPayload({
        id: "transfer_a_to_b",
        eventTimestampMs: 1000,
        destinationUserId: "owner_b",
        destinationEntitlements: activeEntitlements,
        originUserId: "owner_a",
        originEntitlements: {},
      })
    );

    const ownerB = await customerDoc("owner_b");
    expect(ownerB.get("entitlements")).toEqual({});
    expect(ownerB.get("rc_last_event_timestamp_ms")).toEqual(2000);

    const ownerC = await customerDoc("owner_c");
    expect(ownerC.get("entitlements")).toEqual(activeEntitlements);
  });

  it("does not re-grant custom claims to the previous owner on a stale transfer", async () => {
    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      SET_CUSTOM_CLAIMS: "ENABLED",
    };

    const { handler } = require("../index");
    const auth = admin.auth();

    await auth.importUsers(
      ["claims_owner_a", "claims_owner_b", "claims_owner_c"].map(
        (uid, index) => ({
          uid,
          email: `${uid}@example.com`,
          passwordHash: Buffer.from(`passwordHash${index}`),
          passwordSalt: Buffer.from(`salt${index}`),
        })
      ),
      {
        hash: {
          algorithm: "HMAC_SHA256",
          key: Buffer.from("secretKey"),
        },
      }
    );

    await sleep(100);

    await deliver(
      transferPayload({
        id: "claims_transfer_b_to_c",
        eventTimestampMs: 2000,
        destinationUserId: "claims_owner_c",
        destinationEntitlements: activeEntitlements,
        originUserId: "claims_owner_b",
        originEntitlements: {},
      }),
      handler
    );

    expect((await auth.getUser("claims_owner_b")).customClaims).toEqual({
      revenueCatEntitlements: [],
      revenueCatEntitlementsExpiresAtMs: {},
      revenueCatEventTimestampMs: 2000,
    });

    await deliver(
      transferPayload({
        id: "claims_transfer_a_to_b",
        eventTimestampMs: 1000,
        destinationUserId: "claims_owner_b",
        destinationEntitlements: activeEntitlements,
        originUserId: "claims_owner_a",
        originEntitlements: {},
      }),
      handler
    );

    expect((await auth.getUser("claims_owner_b")).customClaims).toEqual({
      revenueCatEntitlements: [],
      revenueCatEntitlementsExpiresAtMs: {},
      revenueCatEventTimestampMs: 2000,
    });
    expect((await auth.getUser("claims_owner_c")).customClaims).toEqual({
      revenueCatEntitlements: ["pro"],
      revenueCatEntitlementsExpiresAtMs: {
        pro: moment.utc(activeEntitlements.pro.expires_date).valueOf(),
      },
      revenueCatEventTimestampMs: 2000,
    });

    process.env = originalProcessEnv;
  });

  it("publishes a null per-entitlement expiry for an entitlement that never expires", async () => {
    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      SET_CUSTOM_CLAIMS: "ENABLED",
    };

    const { handler } = require("../index");
    const auth = admin.auth();

    await auth.importUsers(
      [
        {
          uid: "claims_lifetime_owner",
          email: "claims_lifetime_owner@example.com",
          passwordHash: Buffer.from("passwordHash"),
          passwordSalt: Buffer.from("salt"),
        },
      ],
      {
        hash: {
          algorithm: "HMAC_SHA256",
          key: Buffer.from("secretKey"),
        },
      }
    );

    await sleep(100);

    await deliver(
      {
        ...validPayload,
        event: {
          ...validPayload.event,
          id: "lifetime_only_event",
          app_user_id: "claims_lifetime_owner",
          aliases: ["claims_lifetime_owner"],
        },
        customer_info: {
          ...validPayload.customer_info,
          entitlements: {
            lifetime: { expires_date: null },
          },
        },
      },
      handler
    );

    expect((await auth.getUser("claims_lifetime_owner")).customClaims).toEqual({
      revenueCatEntitlements: ["lifetime"],
      revenueCatEntitlementsExpiresAtMs: { lifetime: null },
      revenueCatEventTimestampMs: EVENT_TIMESTAMP_MS,
    });

    process.env = originalProcessEnv;
  });

  it("does not re-grant custom claims on a stale transfer without a customers collection", async () => {
    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      SET_CUSTOM_CLAIMS: "ENABLED",
      // Without a customers collection there is no document watermark, so the
      // claims watermark is the only thing standing between a stale transfer
      // and a re-granted claim.
      REVENUECAT_CUSTOMERS_COLLECTION: "",
    };

    const { handler } = require("../index");
    const auth = admin.auth();

    await auth.importUsers(
      ["nocoll_owner_a", "nocoll_owner_b", "nocoll_owner_c"].map(
        (uid, index) => ({
          uid,
          email: `${uid}@example.com`,
          passwordHash: Buffer.from(`passwordHash${index}`),
          passwordSalt: Buffer.from(`salt${index}`),
        })
      ),
      {
        hash: {
          algorithm: "HMAC_SHA256",
          key: Buffer.from("secretKey"),
        },
      }
    );

    await sleep(100);

    await deliver(
      transferPayload({
        id: "nocoll_transfer_b_to_c",
        eventTimestampMs: 2000,
        destinationUserId: "nocoll_owner_c",
        destinationEntitlements: activeEntitlements,
        originUserId: "nocoll_owner_b",
        originEntitlements: {},
      }),
      handler
    );

    expect((await auth.getUser("nocoll_owner_b")).customClaims).toEqual({
      revenueCatEntitlements: [],
      revenueCatEntitlementsExpiresAtMs: {},
      revenueCatEventTimestampMs: 2000,
    });

    await deliver(
      transferPayload({
        id: "nocoll_transfer_a_to_b",
        eventTimestampMs: 1000,
        destinationUserId: "nocoll_owner_b",
        destinationEntitlements: activeEntitlements,
        originUserId: "nocoll_owner_a",
        originEntitlements: {},
      }),
      handler
    );

    expect((await auth.getUser("nocoll_owner_b")).customClaims).toEqual({
      revenueCatEntitlements: [],
      revenueCatEntitlementsExpiresAtMs: {},
      revenueCatEventTimestampMs: 2000,
    });
    expect((await auth.getUser("nocoll_owner_c")).customClaims).toEqual({
      revenueCatEntitlements: ["pro"],
      revenueCatEntitlementsExpiresAtMs: {
        pro: moment.utc(activeEntitlements.pro.expires_date).valueOf(),
      },
      revenueCatEventTimestampMs: 2000,
    });

    process.env = originalProcessEnv;
  });

  it("revokes the previous owner's claims on a transfer without a destination user", async () => {
    jest.resetModules();
    const originalProcessEnv = process.env;
    process.env = {
      ...originalProcessEnv,
      SET_CUSTOM_CLAIMS: "ENABLED",
    };

    const { handler } = require("../index");
    const auth = admin.auth();

    await auth.importUsers(
      [
        {
          uid: "transfer_origin_only",
          email: "transfer_origin_only@example.com",
          passwordHash: Buffer.from("passwordHash"),
          passwordSalt: Buffer.from("salt"),
        },
      ],
      {
        hash: {
          algorithm: "HMAC_SHA256",
          key: Buffer.from("secretKey"),
        },
      }
    );

    await sleep(100);

    // Grant the entitlement first so the transfer below is a genuine revocation.
    await deliver(
      {
        ...validPayload,
        event: {
          ...validPayload.event,
          id: "origin_only_grant",
          event_timestamp_ms: 3000,
          app_user_id: "transfer_origin_only",
          aliases: ["transfer_origin_only"],
        },
        customer_info: {
          ...validPayload.customer_info,
          entitlements: activeEntitlements,
        },
      },
      handler
    );

    expect((await auth.getUser("transfer_origin_only")).customClaims).toEqual({
      revenueCatEntitlements: ["pro"],
      revenueCatEntitlementsExpiresAtMs: {
        pro: moment.utc(activeEntitlements.pro.expires_date).valueOf(),
      },
      revenueCatEventTimestampMs: 3000,
    });

    // A transfer away from the origin that names no destination user must still
    // revoke the origin's claims.
    await deliver(
      {
        api_version: validPayload.api_version,
        event: {
          id: "transfer_without_destination",
          event_timestamp_ms: 4000,
          type: "TRANSFER",
          aliases: [],
          origin_app_user_id: "transfer_origin_only",
          transferred_from: ["transfer_origin_only"],
          transferred_to: [],
        },
        customer_info: { original_app_user_id: "", entitlements: {} },
        origin_customer_info: {
          original_app_user_id: "transfer_origin_only",
          entitlements: {},
        },
      },
      handler
    );

    expect((await auth.getUser("transfer_origin_only")).customClaims).toEqual({
      revenueCatEntitlements: [],
      revenueCatEntitlementsExpiresAtMs: {},
      revenueCatEventTimestampMs: 4000,
    });

    process.env = originalProcessEnv;
  });
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
          ...payloadWithEventId("events_missing_user"),
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
