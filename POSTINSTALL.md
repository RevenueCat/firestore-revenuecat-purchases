#### Set your Cloud Firestore security rules

[Set up your security roles](https://docs.revenuecat.com/docs/firebase-integration#set-your-cloud-firestore-security-rules) so that only authenticated users can access customer information, and that each user can only access their own information. 

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /${param:REVENUECAT_CUSTOMERS_COLLECTION}/{uid} {
      allow read: if request.auth.uid == uid;
    }

    match /${param:REVENUECAT_EVENTS_COLLECTION}/{id} {
      allow read: if request.auth.uid == resource.data.app_user_id
    }
  }
}
```

#### Configure the Firebase Integration in the RevenueCat dashboard

Log in to your [RevenueCat Account](https://app.revenuecat.com), select your project in the navigation, then go to integrations -> Firebase. In the section "RevenueCat Firebase Extension", in the field **Webhook URL**, enter the following value: 
```
${function:handler.url}
```

##### Configure the RevenueCat SDK in your mobile app

Follow the steps in the [RevenueCat documentation](https://docs.revenuecat.com/docs/getting-started) to add the RevenueCat SDK to your mobile app. In addition, follow the instructions to [set up the Firebase Integration](https://docs.revenuecat.com/docs/firebase-integration) inside the app by:

- Listening to Firebase Authentication events and [setting the RevenueCat app user ID to the Firebase UID](https://docs.revenuecat.com/docs/firebase-integration#2-set-firebase-user-identity-in-revenuecat).
- Setting the [reserved RevenueCat subscriber attribute](https://docs.revenuecat.com/docs/firebase-integration#set-firebaseappinstanceid-as-a-subscriber-attribute) `$firebaseAppInstanceId` to the Firebase App Instance ID if you want to send events to Google Analytics for Firebase.

### Using the extension

#### Making purchases

To make in-app purchases, use the RevenueCat SDK in your mobile app as per [the RevenueCat documentation](https://docs.revenuecat.com/docs/making-purchases).

#### Checking entitlement access

To check access to entitlements, you can either [use the RevenueCat SDK](https://docs.revenuecat.com/docs/getting-started#10-get-subscription-status) or use Firebase Authentication custom claims. For example, to check whether the current user has access to an entitlement called `premium`, you could use the following Firebase code:

```javascript
getAuth().currentUser.getIdTokenResult()
  .then((idTokenResult) => {
     // Confirm the user has a premium entitlement.
     if (!!idTokenResult.claims.activeEntitlements.includes("premium")) {
       // Show premium UI.
       showPremiumUI();
     } else {
       // Show regular user UI.
       showFreeUI();
     }
  })
  .catch((error) => {
    console.log(error);
  });
```

#### List a user's active subscriptions

To list a user's active subscriptions, you could use the following Firebase code:

```javascript
getDoc(doc(db, "${param:REVENUECAT_CUSTOMERS_COLLECTION}", getAuth().currentUser.uid))
  .then((snapshot) => {
    if (snapshot.exists()) {
      snapshot.subscriptions
        .filter(subscription => subscription.expires_date.toDate() >= new Date())
        .forEach(subscription => console.log(JSON.stringify(subscription)));
    }
  });
```

#### React to subscription lifecycle events

Subscription lifecycle events get stored as events in the Firestore collection `${param:REVENUECAT_EVENTS_COLLECTION}`. By listening to changes in this collection, for example, through [Cloud Firestore triggered Firebase Cloud Functions](https://firebase.google.com/docs/functions/firestore-events), you can trigger any custom behavior that you want. An example could be sending push notifications to customers with billing issues to prompt them to update their credit cards. To do that, you would:

- Store a push notification token for each of your app users, e.g., using [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- Create a new Cloud Function triggered whenever a new document is created in the `${param:REVENUECAT_EVENTS_COLLECTION}` collection
- In the Cloud Function, determine if the `type` field of the new document is `"BILLING_ISSUE"`
- If so, look up the app user ID from the `app_user_id` field of the new document
- Look up the push token for that app user ID and send a push notification
