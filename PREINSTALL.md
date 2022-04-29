Install this extension to use Firebase services as your RevenueCat backend for in-app purchases on Apple App Store, Google Play Store, and Amazon Appstore.

The extension makes in-app purchases and subscriptions, controls access to premium content, and syncs customer purchase information to Firestore using [RevenueCat](https://www.revenuecat.com/).

This extension can:
- Store purchase lifecycle events (e.g., trial starts, purchases, subscription renewals, billing issues) in Firestore and react to them.
- Store and update information about customers and their purchases in Firestore.
- Update information about customers' entitlements as Firebase Authentication [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims).

RevenueCat supports both native iOS and Android apps as well as hybrid cross-platform apps in [React Native](https://docs.revenuecat.com/docs/reactnative), [Flutter](https://docs.revenuecat.com/docs/flutter), [Unity](https://docs.revenuecat.com/docs/unity), [Cordova](https://docs.revenuecat.com/docs/cordova), and [Ionic](https://docs.revenuecat.com/docs/ionic).

You need to [create a RevenueCat account](https://app.revenuecat.com/signup) or already have one set up to use this extension.

#### Additional setup

##### Firebase

Before installing this extension, set up the following Firebase services in your Firebase project:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store In-App Purchases & Subscriptions details.
  - Follow the steps in the [documentation](https://firebase.google.com/docs/firestore/quickstart#create) to create a Cloud Firestore database.
- (optional) [Firebase Authentication](https://firebase.google.com/docs/auth) to enable different sign-up options for your users to enable Custom Claims management.
  - Enable the sign-in methods in the [Firebase console](https://console.firebase.google.com/project/_/authentication/providers) that you want to offer your users.

##### RevenueCat

- Create a [RevenueCat Project](https://docs.revenuecat.com/docs/projects) if you haven't already.
- [Set up a Firebase integration](https://docs.revenuecat.com/docs/firebase-integration) in [RevenueCat](https://app.revenuecat.com/): Go to your project settings, and under "Integrations", click "Add", then "Firebase".
- From the newly created integration, copy your *shared secret*. You will need this to set up the extension.

##### Mobile App

Follow the steps in the [RevenueCat documentation](https://docs.revenuecat.com/docs/getting-started) to add the RevenueCat SDK to your mobile app. In addition, follow the instructions to [set up the Firebase Integration](https://docs.revenuecat.com/docs/firebase-integration) inside the app by:

- Listening to Firebase Authentication events and [setting the RevenueCat app user ID to the Firebase UID](https://docs.revenuecat.com/docs/firebase-integration#2-set-firebase-user-identity-in-revenuecat).
- Setting the [reserved RevenueCat subscriber attribute](https://docs.revenuecat.com/docs/firebase-integration#set-firebaseappinstanceid-as-a-subscriber-attribute) `$firebaseAppInstanceId` to the Firebase App Instance ID if you want to send events to Google Analytics for Firebase.

#### Billing

Your Firebase project must be on the Blaze (pay-as-you-go) plan to install an extension.

You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used). In addition, this extension uses the following Firebase services, which may have associated charges if you exceed the service's free tier for low-volume use ([Learn more about Firebase billing](https://firebase.google.com/pricing)):

- Cloud Firestore
- Cloud Functions

This extension also requires you have a RevenueCat account. You are responsible for any costs associated with your RevenueCat usage ([RevenueCat pricing information](https://www.revenuecat.com/pricing)).


