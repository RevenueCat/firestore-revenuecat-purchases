const mockRequiresRole = jest.fn();
const mockRequiresAPI = jest.fn();

jest.mock("firebase-functions/v2", () => ({
  ...jest.requireActual("firebase-functions/v2"),
  requiresRole: mockRequiresRole,
  requiresAPI: mockRequiresAPI,
}));

const loadKit = (env: Record<string, string>) => {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...env };
  try {
    let kit: any;
    jest.isolateModules(() => {
      kit = require("../index");
    });
    return kit;
  } finally {
    process.env = originalEnv;
  }
};

describe("deployment manifest", () => {
  beforeEach(() => {
    mockRequiresRole.mockClear();
    mockRequiresAPI.mockClear();
  });

  it("exports only the webhook handler", () => {
    expect(Object.keys(loadKit({}))).toEqual(["handler"]);
  });

  it("declares the roles the extension had", () => {
    loadKit({ EVENTARC_CHANNEL: "" });

    expect(mockRequiresRole.mock.calls).toEqual([
      ["roles/datastore.user"],
      ["roles/firebaseauth.admin"],
    ]);
    expect(mockRequiresAPI).not.toHaveBeenCalled();
  });

  it("declares the Eventarc role and API when events are on", () => {
    loadKit({
      EVENTARC_CHANNEL: "projects/p/locations/us-central1/channels/firebase",
      EXT_SELECTED_EVENTS: "com.revenuecat.v1.transfer",
    });

    expect(mockRequiresRole).toHaveBeenCalledWith("roles/eventarc.publisher");
    expect(mockRequiresAPI).toHaveBeenCalledWith(
      "eventarcpublishing.googleapis.com",
      expect.any(String)
    );
  });

  it("doesn't declare the Eventarc role and API for a channel without selected events", () => {
    loadKit({
      EVENTARC_CHANNEL: "projects/p/locations/us-central1/channels/firebase",
      EXT_SELECTED_EVENTS: "",
    });

    expect(mockRequiresRole).not.toHaveBeenCalledWith("roles/eventarc.publisher");
    expect(mockRequiresAPI).not.toHaveBeenCalled();
  });

  it("deploys a 2nd gen function in LOCATION with the shared secret", () => {
    const { handler } = loadKit({});

    // Serialized the way the CLI reads it: params become "params.<NAME>" references.
    expect(JSON.parse(JSON.stringify(handler.__endpoint))).toMatchObject({
      platform: "gcfv2",
      region: "params.LOCATION",
      secretEnvironmentVariables: [{ key: "REVENUECAT_SHARED_SECRET" }],
      httpsTrigger: {},
    });
  });
});
