# firestore-revenuecat-purchases

The RevenueCat function kit for Firebase, [`@revenuecat/firestore-revenuecat-purchases`](https://www.npmjs.com/package/@revenuecat/firestore-revenuecat-purchases), uses Firebase services as your RevenueCat backend for in-app purchases on Apple App Store, Google Play Store, and Amazon Appstore to control access to premium content and sync customer purchase information to Firestore. For example, you might want to:

- Store purchase lifecycle events (e.g., trial starts, purchases, subscription renewals, billing issues) in Firestore and react to them.
- Store and update information about customers and their purchases in Firestore.
- Update information about customers' entitlements as Firebase Authentication Custom Claims.
- Publish RevenueCat events to Eventarc, so your own functions can react to them.

Get started:

- [Install the function kit](kit/README.md#install)
- [Migrate from the Firebase Extension](kit/README.md#migrating-from-the-extension)
- [Update the function kit](kit/README.md#update)
- [Documentation](https://docs.revenuecat.com/docs/firebase-integration)

The Firebase CLI installs the kit from npm, so you don't need to clone this repository. Its source is in [`kit/`](kit/).

## Firebase Extension (deprecated)

> [!WARNING]
> Don't install the RevenueCat Firebase Extension (`revenuecat/firestore-revenuecat-purchases`) in new projects. Google shuts down Firebase Extensions on March 31, 2027, and the extension will be deprecated. If you already use it, [migrate to the function kit](kit/README.md#migrating-from-the-extension).

The extension's source (`extension.yaml`, `functions/`) stays in this repo until then.
