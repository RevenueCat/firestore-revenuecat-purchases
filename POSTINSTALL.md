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