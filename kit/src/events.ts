import { Channel, getEventarc } from "firebase-admin/eventarc";

let channel: Channel | null | undefined;

const channelName = (): string => process.env.EVENTARC_CHANNEL?.trim() ?? "";

const selectedEventTypes = (): string[] =>
  (process.env.EXT_SELECTED_EVENTS ?? "")
    .split(",")
    .map((type) => type.trim())
    .filter((type) => type.length > 0);

/**
 * Whether events are on: both EVENTARC_CHANNEL and a non-empty EXT_SELECTED_EVENTS are set,
 * since firebase-admin reads a missing allow list as "allow every type".
 */
export const eventsEnabled = (): boolean =>
  channelName().length > 0 && selectedEventTypes().length > 0;

/** The Eventarc channel to publish RevenueCat events to, or null when events are off. */
const getChannel = (): Channel | null => {
  if (channel === undefined) {
    channel = eventsEnabled()
      ? getEventarc().channel(channelName(), { allowedEventTypes: selectedEventTypes() })
      : null;
  }
  return channel;
};

/**
 * Publishes a RevenueCat event as a `com.revenuecat.v1.<type>` custom event.
 *
 * A failure fails the webhook, as in the extension, so RevenueCat retries the event. The
 * retry rewrites the same documents, which is safe.
 */
export const publishEvent = async (eventType: string, data: object): Promise<void> => {
  await getChannel()?.publish({ type: `com.revenuecat.v1.${eventType}`, data });
};

/** Forgets the cached channel so tests can change the env between cases. */
export const resetEventChannelForTests = (): void => {
  channel = undefined;
};
