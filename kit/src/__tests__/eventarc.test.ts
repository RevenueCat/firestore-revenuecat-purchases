const mockPublish = jest.fn();
const mockChannel = jest.fn(() => ({ publish: mockPublish }));

jest.mock("firebase-admin/eventarc", () => ({
  getEventarc: () => ({ channel: mockChannel }),
}));

import { publishEvent, resetEventChannelForTests } from "../events";

const CHANNEL = "projects/demo-revenuecat/locations/us-central1/channels/firebase";

describe("publishEvent", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EVENTARC_CHANNEL;
    delete process.env.EXT_SELECTED_EVENTS;
    resetEventChannelForTests();
    mockPublish.mockReset();
    mockChannel.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("does nothing without a channel", async () => {
    process.env.EXT_SELECTED_EVENTS = "com.revenuecat.v1.transfer";

    await publishEvent("transfer", { id: "1" });

    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("does nothing without selected events, instead of publishing every type", async () => {
    process.env.EVENTARC_CHANNEL = CHANNEL;
    process.env.EXT_SELECTED_EVENTS = " , ";

    await publishEvent("transfer", { id: "1" });

    expect(mockChannel).not.toHaveBeenCalled();
  });

  it("trims the selected event types", async () => {
    process.env.EVENTARC_CHANNEL = CHANNEL;
    process.env.EXT_SELECTED_EVENTS = "com.revenuecat.v1.transfer, com.revenuecat.v1.renewal";

    await publishEvent("transfer", { id: "1" });

    expect(mockChannel).toHaveBeenCalledWith(CHANNEL, {
      allowedEventTypes: ["com.revenuecat.v1.transfer", "com.revenuecat.v1.renewal"],
    });
  });

  it("publishes the event as com.revenuecat.v1.<type>", async () => {
    process.env.EVENTARC_CHANNEL = CHANNEL;
    process.env.EXT_SELECTED_EVENTS = "com.revenuecat.v1.transfer";

    await publishEvent("transfer", { id: "1" });

    expect(mockPublish).toHaveBeenCalledWith({
      type: "com.revenuecat.v1.transfer",
      data: { id: "1" },
    });
  });

  it("swallows publish failures", async () => {
    process.env.EVENTARC_CHANNEL = CHANNEL;
    process.env.EXT_SELECTED_EVENTS = "com.revenuecat.v1.transfer";
    mockPublish.mockRejectedValue(new Error("PERMISSION_DENIED"));

    await expect(publishEvent("transfer", { id: "1" })).resolves.toBeUndefined();
  });
});
