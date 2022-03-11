import * as functions from "firebase-functions";

export const logMessage = (
  message: string | { message: string; code: number },
  level: "info" | "error" = "info"
) => {
  functions.logger[level](message, { structuredData: true });
};
