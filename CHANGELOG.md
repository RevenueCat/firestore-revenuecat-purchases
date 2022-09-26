## Version 0.1.6

- Fixes a typo in non_renewing_purchase event that prevented publishing to Eventarc. https://github.com/RevenueCat/firestore-revenuecat-purchases/pull/42. Thanks @SDrinkWater!

## Version 0.1.5

- Fixes https://github.com/RevenueCat/firestore-revenuecat-purchases/issues/36

## Version 0.1.4

- Fixes https://github.com/RevenueCat/firestore-revenuecat-purchases/issues/33
- Implements subcollections https://github.com/RevenueCat/firestore-revenuecat-purchases/issues/34. Now, the users collection
parameter can contain a {app_user_id} wildcard to allow for subcollections inside an existing user document.

## Version 0.1.3

- Reverts the changes made in 0.1.2 for safety, as that introduced a regression for users that would
have existing user collections. This is a temporary measure before adding a more robust customer collection configuration.

## Version 0.1.2

- Attempts to Fix: https://github.com/RevenueCat/firestore-revenuecat-purchases/issues/33 but introduces a regression
that overwrites existing data.
## Version 0.1.1

- Updated billing copy in PREINSTALL.md.
## Version 0.1.0

General audience release.
## Version 0.0.2

- GitHub repository was renamed to firestore-revenuecat-purchases
## Version 0.0.1

Initial release of the _Enable In-App Purchases with RevenueCat_ extension.