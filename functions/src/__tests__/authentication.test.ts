import {
  createJWT,
  EXPECTED_AUTH_ERROR,
  getMockedRequest,
  getMockedResponse,
} from "./utils";
import * as api from "../index";

describe("authentication", () => {
  afterEach(() => {
    // @ts-ignore
    global.firebaseTest.cleanup();
  });

  const validPayload = {
    api_version: "1.0.0",
    event: { id: "uuid", app_user_id: "toni_free", aliases: ["toni_free"] },
    customer_info: { original_app_user_id: "tonidelevate" },
  };

  it("should authenticate with a valid JWT", (done) => {
    const mockedResponse = getMockedResponse(expect, () => done())(
      200,
      {}
    ) as any;
    const payload = validPayload;
    const mockedRequest = getMockedRequest(
      createJWT(60, payload, "test_secret")
    ) as any;

    api.handler(mockedRequest, mockedResponse);
  });

  it("should not authenticate with an expired JWT", (done) => {
    const expectedReponse = EXPECTED_AUTH_ERROR;

    const mockedResponse = getMockedResponse(expect, () => done())(
      401,
      expectedReponse
    ) as any;
    const payload = validPayload;
    const mockedRequest = getMockedRequest(
      createJWT(-60, payload, "test_secret")
    ) as any;

    api.handler(mockedRequest, mockedResponse);
  });

  it("should not authenticate with an invalid secret", (done) => {
    const expectedReponse = EXPECTED_AUTH_ERROR;

    const mockedResponse = getMockedResponse(expect, () => done())(
      401,
      expectedReponse
    ) as any;
    const payload = validPayload;
    const mockedRequest = getMockedRequest(
      createJWT(60, payload, "invalid_secret")
    ) as any;

    api.handler(mockedRequest, mockedResponse);
  });

  it("should not authenticate with an invalid payload", (done) => {
    const mockedResponse = getMockedResponse(expect, () => done())(
      401,
      EXPECTED_AUTH_ERROR
    ) as any;
    const payload = validPayload;
    const validJWT = createJWT(60, payload, "test_secret");

    const [header, _jwtPayload, signature] = validJWT.split(".");

    const extractedJwt = JSON.parse(
      Buffer.from(_jwtPayload, "base64").toString("ascii")
    );

    const craftedPayload = Buffer.from(
      JSON.stringify({
        ...extractedJwt,
        payload: {
          ...extractedJwt.payload,
          foo: "baz",
        },
      })
    ).toString("base64");

    const craftedJwt = [header, craftedPayload, signature].join(".");

    const mockedRequest = getMockedRequest(craftedJwt) as any;

    api.handler(mockedRequest, mockedResponse);
  });

  it("returns a version error if it's not the same", (done) => {
    const expectedError = JSON.stringify({
      error: {
        code: 2,
        message:
          "The version of this extension is not the same. Extension version 1.0.0, Api version: 0.0.9. Please retry the request with the correct version",
      },
    });

    const mockedResponse = getMockedResponse(expect, () => done())(
      400,
      expectedError
    ) as any;
    const payload = {
      ...validPayload,
      api_version: "0.0.9",
    };

    api.handler(
      getMockedRequest(createJWT(60, payload, "test_secret")) as any,
      mockedResponse
    );
  });
});
