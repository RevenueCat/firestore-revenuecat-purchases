import { Channel, getEventarc } from "firebase-admin/eventarc";

let channel: Channel | null | undefined;

/**
 * The Eventarc channel to publish RevenueCat events to, or null when events are off.
 *
 * Events are on only when both EVENTARC_CHANNEL and a non-empty EXT_SELECTED_EVENTS are
 * set: firebase-admin reads a missing allow list as "allow every type".
 */
const getChannel = (): Channel | null => {
  if (channel !== undefined) {
    return channel;
  }

  const channelName = process.env.EVENTARC_CHANNEL?.trim();
  const allowedEventTypes = (process.env.EXT_SELECTED_EVENTS ?? "")
    .split(",")
    .map((type) => type.trim())
    .filter((type) => type.length > 0);

  channel =
    channelName && allowedEventTypes.length > 0
      ? getEventarc().channel(channelName, { allowedEventTypes })
      : null;
  return channel;
};

export const eventsEnabled = (): boolean => Boolean(process.env.EVENTARC_CHANNEL?.trim());

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
