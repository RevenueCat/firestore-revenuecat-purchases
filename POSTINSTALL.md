### Configuring the extension

Before you proceed, make sure you have the following Firebase services set up:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store customer information and purchase lifecycle events.
  - Follow the steps in the [documentation](https://firebase.google.com/docs/firestore/quickstart#create) to create a Cloud Firestore database.
- [Firebase Authentication](https://firebase.google.com/docs/auth) to enable different sign-up options for your users.
  - Enable the sign-in methods in the [Firebase console](https://console.firebase.google.com/project/_/authentication/providers) that you want to offer your users.

#### Set your Cloud Firestore security rules
Set up your security roles so that only authenticated users can access customer information, and that each user can only access their own information. 

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /${param:REVENUECAT_CUSTOMERS_COLLECTION}/{uid} {
      allow read: if request.auth.uid == uid;
    }

    match /${param:REVENUECAT_EVENTS_COLLECTION}/{id} {
      allow read: if request.auth.uid == resource.app_user_id
    }
  }
}
```

#### Configure the Firebase Integration in the RevenueCat dashboard

Log in to your [RevenueCat Account](https://app.revenuecat.com), select your project in the navigation, then go to integrations -> Firebase. In the section "RevenueCat Firebase Extension", in the field **Webhook URL**, enter the following value: 
```
${function:handler.url}
```
