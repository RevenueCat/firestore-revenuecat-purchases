## Version 0.1.17

- Upgrade to multiple libraries
- Upgrading firebase-admin to the latest version to fix permissions error in the function when setting custom claims.

## Version 0.1.16

- Upgraded Node.js from version 18 to version 20 https://github.com/RevenueCat/firestore-revenuecat-purchases/pull/98/files

## Version 0.1.15

- Regenerate lock file to address extension deployment issues

## Version 0.1.14

- Upgraded several dependencies to address CVE-2023-36665

## Version 0.1.13

- Upgraded firebase-functions to ^4.9.0 to address CVE-2024-28176

## Version 0.1.12

- Upgraded Node.js from version 14 to version 18 https://github.com/RevenueCat/firestore-revenuecat-purchases/pull/66/files

## Version 0.1.11

- Upgraded protobufjs to address a security vulnerability https://github.com/RevenueCat/firestore-revenuecat-purchases/pull/62/files

## Version 0.1.10

- Upgrade firebase-admin to the latest version: https://github.com/RevenueCat/firestore-revenuecat-purchases/pull/58

## Version 0.1.9

- Extension to 0.1.8, upgrades also transitive dependencies

## Version 0.1.8

- Upgrades jest and typescript to address a vulnerability in JSON5 (https://github.com/RevenueCat/firestore-revenuecat-purchases/pull/55).

## Version 0.1.7

- Returns extension version as part of the response payload to fix an issue with automatic version ugprades. Fixes https://github.com/RevenueCat/firestore-revenuecat-purchases/issues/48

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
