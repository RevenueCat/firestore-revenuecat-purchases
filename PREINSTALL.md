#### How this extension works

This extension facilitates in-app purchases and subscriptions, controls access to premium content, and syncs purchase information to Firestore, using [RevenueCat](https://www.revenuecat.com).

Using this extension, you can use Firebase as your backend for mobile in-app purchases and subscriptions on Apple App Store, Google Play Store, and Amazon Appstore, powered by RevenueCat's in-app purchase infrastructure.

Using RevenueCat and this integration allows you to:
- Store purchase lifecycle events (e.g., purchases, subscription renewals, billing issues) in Firestore and react to them
- Store and update information about customers and their purchases in Firestore
- Update information about customers' entitlements as Firebase Authentication [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims).

RevenueCat supports both native iOS and Android apps as well as hybrid cross-platform apps in [React Native](https://docs.revenuecat.com/docs/reactnative), [Flutter](https://docs.revenuecat.com/docs/flutter), [Unity](https://docs.revenuecat.com/docs/unity), [Cordova](https://docs.revenuecat.com/docs/cordova), and [Ionic](https://docs.revenuecat.com/docs/ionic).

You need to separately set up (or have already set up) your RevenueCat project.

#### Additional setup

##### Firebase

Before installing this extension, set up the following Firebase services in your Firebase project:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store In-App Purchases & Subscriptions details.
  - Follow the steps in the [documentation](https://firebase.google.com/docs/firestore/quickstart#create) to create a Cloud Firestore database.
- (optional) [Firebase Authentication](https://firebase.google.com/docs/auth) to enable different sign-up options for your users to enable the Custom Claims management.
- Enable the sign-in methods in the [Firebase console](https://console.firebase.google.com/project/_/authentication/providers) that you want to offer your users.

##### RevenueCat

- Create a new Project in RevenueCat if you haven't already.
- Set up a Firebase integration in [RevenueCat](https://app.revenuecat.com/): Go to your project settings, and under "Integrations", click "Add", then "Firebase".
- From the newly created integration, copy your *shared secret*, you will need this to set up the extension.

##### Mobile App

Follow the steps in the [RevenueCat documentation](https://docs.revenuecat.com/docs/getting-started) to add the RevenueCat SDK to your mobile app. In addition, follow the instructions to set up the Firebase Integration inside the app by:

- Listening to Firebase Authentication events and setting the RevenueCat user ID to the Firebase UID.
- Setting the reserved RevenueCat subscriber attribute for the Firebase App Instance ID, if you want to send events to Google Analytics for Firebase.

#### Billing

This extension uses the following Firebase services which may have associated charges:

- Cloud Firestore
- Cloud Functions

This extension also uses the following third-party services:

- RevenueCat ([pricing information](https://www.revenuecat.com/pricing))

You are responsible for any costs associated with your use of these services.

#### Note from Firebase

To install this extension, your Firebase project must be on the Blaze (pay-as-you-go) plan. You will only be charged for the resources you use. Most Firebase services offer a free tier for low-volume use. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

You will be billed a small amount (typically less than $0.10) when you install or reconfigure this extension. See the [Cloud Functions for Firebase billing FAQ](https://firebase.google.com/support/faq#expandable-15) for a detailed explanation.
