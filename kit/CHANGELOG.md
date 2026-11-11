## 1.0.0

First release of the RevenueCat function kit, replacing the RevenueCat Firebase Extension 0.2.0.

- Runs as a 2nd gen Cloud Function, installed with `firebase functions:kits:install` or `firebase ext:migrate`.
- Same params, shared secret, Firestore documents, custom claims and Eventarc events as the extension.
- Eventarc events are published only when both `EVENTARC_CHANNEL` and `EXT_SELECTED_EVENTS` are set, and spaces in `EXT_SELECTED_EVENTS` are ignored.
