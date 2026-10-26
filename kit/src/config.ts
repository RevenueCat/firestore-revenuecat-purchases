import { defineSecret, defineString, select } from "firebase-functions/params";

// Names match the extension's params: `firebase ext:migrate` seeds .env under the same keys.

const COLLECTION_PATH_REGEX = "^$|^[^/]+(/[^/]+/[^/]+)*$";
const COLLECTION_PATH_ERROR =
  "Firestore collection paths must be an odd number of segments separated by slashes, " +
  "e.g. \"path/to/collection\". Leave empty to disable.";

export const location = defineString("LOCATION", {
  label: "Cloud Functions location",
  description:
    "Where to deploy the webhook function. You usually want a location close to your " +
    "Firestore database.",
  input: select({
    "Iowa (us-central1)": "us-central1",
    "South Carolina (us-east1)": "us-east1",
    "Northern Virginia (us-east4)": "us-east4",
    "Los Angeles (us-west2)": "us-west2",
    "Salt Lake City (us-west3)": "us-west3",
    "Las Vegas (us-west4)": "us-west4",
    "Warsaw (europe-central2)": "europe-central2",
    "Belgium (europe-west1)": "europe-west1",
    "London (europe-west2)": "europe-west2",
    "Frankfurt (europe-west3)": "europe-west3",
    "Zurich (europe-west6)": "europe-west6",
    "Hong Kong (asia-east2)": "asia-east2",
    "Tokyo (asia-northeast1)": "asia-northeast1",
    "Osaka (asia-northeast2)": "asia-northeast2",
    "Seoul (asia-northeast3)": "asia-northeast3",
    "Mumbai (asia-south1)": "asia-south1",
    "Jakarta (asia-southeast2)": "asia-southeast2",
    "Montreal (northamerica-northeast1)": "northamerica-northeast1",
    "Sao Paulo (southamerica-east1)": "southamerica-east1",
    "Sydney (australia-southeast1)": "australia-southeast1",
  }),
  default: "us-east1",
});

export const eventsCollection = defineString("REVENUECAT_EVENTS_COLLECTION", {
  label: "RevenueCat webhook events Firestore collection",
  description:
    "Path to the Cloud Firestore collection where RevenueCat events are stored. " +
    "Leave empty to not store events.",
  input: {
    text: {
      validationRegex: COLLECTION_PATH_REGEX,
      validationErrorMessage: COLLECTION_PATH_ERROR,
    },
  },
  default: "",
});

export const customersCollection = defineString("REVENUECAT_CUSTOMERS_COLLECTION", {
  label: "Customers Firestore collection",
  description:
    "Path to the Cloud Firestore collection where RevenueCat customer details are stored. " +
    "Can be an existing users collection: RevenueCat data is merged into your documents. " +
    "Supports the {app_user_id} placeholder, e.g. users/{app_user_id}/purchaser-info. " +
    "Leave empty to not store customer details.",
  input: {
    text: {
      validationRegex: COLLECTION_PATH_REGEX,
      validationErrorMessage: COLLECTION_PATH_ERROR,
    },
  },
  default: "",
});

export const setCustomClaims = defineString("SET_CUSTOM_CLAIMS", {
  label: "Set Firebase Auth custom claims with the user's active entitlements?",
  description:
    "If ENABLED, the app_user_id is treated as the Firebase Authentication UID and the " +
    "user's active entitlements are written to the revenueCatEntitlements custom claim.",
  input: select(["ENABLED", "DISABLED"]),
  default: "DISABLED",
});

export const sharedSecret = defineSecret("REVENUECAT_SHARED_SECRET", {
  label: "RevenueCat Firebase integration shared secret",
  description:
    "Found in the RevenueCat dashboard under Project > Integrations > Firebase.",
});
