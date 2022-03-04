This extension keep track of your mobile apps' users' In-App Purchases & Subscriptions with [RevenueCat](https://www.revenuecat.com) via Firebase Authentication & Firebase Firestore.
This extension requires you to separately setup (or have already setup) your RevenueCat project.

This extension stores your subscriber events using Cloud Firestore and adds Custom Claims for your users' subscriptions using Firebase Authentication for convenient access control in your application.

#### Recommended usage

This extension is meant for both native & hybrid mobile applications In-App Purchases & Subscriptions using the app stores' In-App Purchases APIs.
Currently supported app stores are the Apple App Store, Googe Play Store, Huawei App Gallery & Amazon App Store.

#### Additional setup

Before installing this extension, set up the following Firebase services in your Firebase project:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store In-App Purchases & Subscriptions details.
  - Follow the steps in the [documentation](https://firebase.google.com/docs/firestore/quickstart#create) to create a Cloud Firestore database.
- (optional) [Firebase Authentication](https://firebase.google.com/docs/auth) to enable different sign-up options for your users to enable the Custom Claims management.
- Enable the sign-in methods in the [Firebase console](https://console.firebase.google.com/project/_/authentication/providers) that you want to offer your users.

- Set up a Firebase integration in [RevenueCat](https://app.revenuecat.com/):

- Get your [shared secret]
Revenuecat > [YOUR PROJECT] > Integrations > Firebase > Get Shared Secret

#### Billing

This extension uses the following Firebase services which may have associated charges:

- Cloud Firestore
- Cloud Functions

This extension also uses the following third-party services:

- RevenueCat ([pricing information](https://www.revenuecat.com/pricing))

You are responsible for any costs associated with your use of these services.

#### Note from Firebase

To install this extension, your Firebase project must be on the Blaze (pay-as-you-go) plan. You will only be charged for the resources you use. Most Firebase services offer a free tier for low-volume use. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Starting August 17 2020, you will be billed a small amount (typically less than $0.10) when you install or reconfigure this extension. See the [Cloud Functions for Firebase billing FAQ](https://firebase.google.com/support/faq#expandable-15) for a detailed explanation.
