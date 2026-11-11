// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require("../package.json") as { version: string };

/** Sent to RevenueCat in X-EXTENSION-VERSION; RevenueCat echoes it back as api_version. */
export const KIT_VERSION = version;
