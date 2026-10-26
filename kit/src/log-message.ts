import { logger } from "firebase-functions/logger";

export const logMessage = (
  message: string | { message: string; code: number },
  level: "info" | "error" = "info"
) => {
  logger[level](message, { structuredData: true });
};
