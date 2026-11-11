import { requiresAPI, requiresRole } from "firebase-functions/v2";
import { eventsEnabled } from "./events";

requiresRole("roles/datastore.user");
requiresRole("roles/firebaseauth.admin");

if (eventsEnabled()) {
  requiresRole("roles/eventarc.publisher");
  requiresAPI(
    "eventarcpublishing.googleapis.com",
    "Publishes RevenueCat events as com.revenuecat.v1.* custom events to your Eventarc channel."
  );
}

export { handler } from "./handler";
