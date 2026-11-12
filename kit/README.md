# RevenueCat function kit for Firebase

`@revenuecat/firestore-revenuecat-purchases` is a [Firebase function kit](https://firebase.google.com/docs/extensions/users/migrate): a 2nd gen Cloud Function you install into your Firebase project. It receives RevenueCat webhooks and keeps your Firebase project in sync with your customers' purchases:

- Stores RevenueCat customer info in a Cloud Firestore collection, merged into your own documents if you want.
- Stores every RevenueCat event in a Cloud Firestore collection.
- Sets a `revenueCatEntitlements` custom claim on Firebase Auth users with their active entitlements.
- Publishes `com.revenuecat.v1.*` custom events to Eventarc, so your own functions can react to them.

It replaces the RevenueCat Firebase Extension (`revenuecat/firestore-revenuecat-purchases`), which stops being manageable when Google shuts down Firebase Extensions on March 31, 2027. Already on the extension? See [Migrating from the extension](#migrating-from-the-extension).

## Before you start

- A Firebase project on the Blaze (pay-as-you-go) plan, with Cloud Firestore set up. Set up Firebase Authentication too if you want custom claims.
- Firebase CLI 15.32.0 or later: `npm install -g firebase-tools`.
- The Firebase integration set up in the RevenueCat dashboard (**Project > Integrations > Firebase**). Generate the shared secret there; you'll need it during install.
- Your app should use the Firebase Auth UID as the RevenueCat App User ID. Custom claims and customer documents are keyed by App User ID.

## Install

From your Firebase project directory:

```bash
firebase functions:kits:install --package @revenuecat/firestore-revenuecat-purchases --project <project-id>
```

- The CLI warns that the package isn't published by Firebase. That's expected for any kit that doesn't come from Google; confirm to continue.
- Keep the default kit name, then pick an instance ID (for example `revenuecat`). It names the deployed function: `kit-<instance-id>-handler`.
- Answer the configuration prompts (see [Configuration](#configuration)), including the shared secret.

Then deploy it:

```bash
firebase deploy --only functions:<instance-id> --project <project-id>
```

Copy the function's URL from the deploy output or from `firebase functions:list --project <project-id>`. It looks like `https://<location>-<project-id>.cloudfunctions.net/kit-<instance-id>-handler`. In the RevenueCat dashboard, paste it into **Webhook URL** under **Project > Integrations > Firebase** and save.

### Check that it works

Make a sandbox purchase, or grant a promotional entitlement to a customer in the RevenueCat dashboard. Then:

- The integration's event list in the RevenueCat dashboard shows the event as delivered.
- The event is in your events collection, and the customer's document is in your customers collection.
- With custom claims enabled, the Firebase Auth user has a `revenueCatEntitlements` claim.

The first event after an install or an update fails with a 400 `InvalidApiVersionError` and is retried a few minutes later. That's how RevenueCat learns the kit's version, not a problem with your setup.

## Configuration

The CLI asks for these during install and saves them in `function-kits/<kit-id>/config-<instance-id>/.env.<project-id>`. To change them, edit that file and deploy again.

| Param | Description |
| :--- | :--- |
| `LOCATION` | Region of the webhook function, e.g. `us-east1`. Pick one close to your Firestore database. Changing it later gives the function a new URL: after you deploy, update **Webhook URL** in the RevenueCat dashboard. |
| `REVENUECAT_EVENTS_COLLECTION` | Firestore collection for RevenueCat events. Empty: events aren't stored. |
| `REVENUECAT_CUSTOMERS_COLLECTION` | Firestore collection for customer info, e.g. `users`. Can point at your existing users collection: RevenueCat fields are merged into your documents and your own fields are left alone. Supports an `{app_user_id}` placeholder, e.g. `users/{app_user_id}/purchaser-info`. Empty: customer info isn't stored. |
| `SET_CUSTOM_CLAIMS` | `ENABLED` sets the `revenueCatEntitlements` custom claim on the Firebase Auth user whose UID is the App User ID. `DISABLED` doesn't touch Auth. |
| `REVENUECAT_SHARED_SECRET` | Secret. The shared secret from the RevenueCat Firebase integration settings. Stored in Cloud Secret Manager. Rotate it in RevenueCat, then run `firebase functions:secrets:set kit-<instance-id>-REVENUECAT_SHARED_SECRET` and deploy again. Migrated from the extension? Also delete the `FIREBASE_SECRET_REF_REVENUECAT_SHARED_SECRET` line from the instance's `.env` file: it still points at the extension's secret. |

The kit also asks for `FUNCTION_DEFAULT_REGION`, the default region of the generated function codebase. The webhook function always deploys to `LOCATION`, so enter the same value.

## Required IAM

The kit declares the roles it needs. On deploy, the Firebase CLI creates a service account for the kit's functions and grants it:

| Role | Why |
| :--- | :--- |
| `roles/datastore.user` | Writes customer and event documents to Cloud Firestore. |
| `roles/firebaseauth.admin` | Sets custom claims on Firebase Auth users. |
| `roles/eventarc.publisher` | Only when [events](#events) are on: publishes custom events. The CLI also enables `eventarcpublishing.googleapis.com`. |

The account that deploys needs permission to create service accounts and set the project's IAM policy, for example Owner, or Editor plus Project IAM Admin. The first deploy asks you to confirm the service account and its roles; when deploying from CI or with `--non-interactive`, pass `--force`.

The function is public: RevenueCat calls it directly. Every request must carry a token signed with your shared secret; anything else gets a 401.

## Using the data

### Check entitlement access with custom claims

```js
const user = firebase.auth().currentUser;
await user.getIdToken(true);
const { claims } = await user.getIdTokenResult();
const hasPremium = claims.revenueCatEntitlements?.includes("premium");
```

### React to events

Each event is stored in `REVENUECAT_EVENTS_COLLECTION`, keyed by event ID. You can trigger your own Cloud Functions on new documents there, or turn on Eventarc events below.

## Events

The kit can publish each RevenueCat event to an Eventarc channel as a custom event of type `com.revenuecat.v1.<event type>`. Add these to the instance's `.env` file and deploy again:

```bash
EVENTARC_CHANNEL=projects/<project-id>/locations/us-central1/channels/firebase
EXT_SELECTED_EVENTS=com.revenuecat.v1.initial_purchase,com.revenuecat.v1.renewal,com.revenuecat.v1.expiration
```

Nothing is published unless both are set. Available types: `test`, `initial_purchase`, `non_renewing_purchase`, `renewal`, `product_change`, `cancellation`, `uncancellation`, `billing_issue`, `subscriber_alias`, `subscription_paused`, `transfer`, `expiration`, each prefixed with `com.revenuecat.v1.`.

Handle them with `onCustomEventPublished`:

```ts
import { onCustomEventPublished } from "firebase-functions/eventarc";

export const onBillingIssue = onCustomEventPublished(
  "com.revenuecat.v1.billing_issue",
  async (event) => {
    const { app_user_id } = event.data;
    // e.g. send a push notification asking the customer to update their payment method
  }
);
```

Deploying a function like this one creates the default `firebase` channel in `us-central1` if it doesn't exist yet. The event's `data` is the RevenueCat webhook event. If publishing fails, the webhook fails and RevenueCat retries the event.

## Migrating from the extension

`firebase ext:migrate` installs the kit with your extension instance's configuration, deploys it, and then offers to uninstall the extension.

**Your webhook URL changes** from `ext-<instance-id>-handler` to `kit-<instance-id>-handler`. RevenueCat keeps sending to the old URL until you change it in the dashboard, so keep the extension installed until you've done that.

1. Run the migration, without `--force` (it uninstalls the extension without asking):

   ```bash
   firebase ext:migrate --ext-instance <extension-instance-id> --package @revenuecat/firestore-revenuecat-purchases --project <project-id>
   ```

   - If the CLI offers to update the extension first, accept.
   - The CLI warns that the package is a third-party kit. Confirm to continue.
   - Keep the default kit name and instance name. The instance name defaults to your extension's instance ID, so the function becomes `kit-<instance-id>-handler`.
   - If it asks for `FUNCTION_DEFAULT_REGION`, enter your extension's `LOCATION`.
   - Confirm the service account and roles the kit's function uses.
   - When it asks **Uninstall it now?**, answer **No**. RevenueCat still sends events to the extension until you change the webhook URL.

2. Copy the new function's URL (`kit-<instance-id>-handler`) and paste it into **Webhook URL** in the RevenueCat dashboard, under **Project > Integrations > Firebase**.
3. Check that new events deliver. The first one fails with a 400 `InvalidApiVersionError` and is retried a few minutes later.
4. Uninstall the extension. Without `--immediate`, the command only removes the extension from your local `firebase.json` and leaves it deployed.

   ```bash
   firebase ext:uninstall <extension-instance-id> --project <project-id> --immediate
   ```

Your shared secret, collections, custom claims setting and Eventarc events carry over. Your Firestore data and custom claims aren't touched.

### Differences from the extension

- The function runs on Cloud Functions 2nd gen, under its own service account.
- The webhook URL and function name start with `kit-` instead of `ext-`.
- Eventarc events have a different `source` attribute: `projects/<project-id>/locations/<location>/services/kit-<instance-id>-handler` instead of `//firebaseextensions.googleapis.com/extensions/projects/<project-id>/instances/<instance-id>`. Filters on `source` need updating; filters on `type` keep working.
- Installing the kit doesn't create an Eventarc channel. Migrated instances keep the extension's channel; for a fresh install, deploying your first `onCustomEventPublished` handler creates the default one.

## Troubleshooting

| Symptom | Cause |
| :--- | :--- |
| 400 `InvalidApiVersionError` on one event, then success | Version handshake after an install or update. Expected. |
| 401 `Incoming RevenueCat webhook could not be authenticated` | The shared secret in the kit doesn't match the one in RevenueCat. Set it again with `firebase functions:secrets:set kit-<instance-id>-REVENUECAT_SHARED_SECRET` (and, if you migrated from the extension, delete the `FIREBASE_SECRET_REF_REVENUECAT_SHARED_SECRET` line from the instance's `.env`), then redeploy. |
| `Error saving user <id>: There is no user record corresponding to the provided identifier` in the logs | Custom claims are enabled but the App User ID isn't a Firebase Auth UID. The Firestore documents are still written. |
| Delivery shows no response, then success on a retry | The function was idle and took longer to start than RevenueCat waits for a response. RevenueCat retries, and the event is delivered. |
| Deploy fails with `Cannot enable declarative security and create managed service account … in non-interactive mode` | The first deploy needs your confirmation for the kit's service account. Deploy interactively once, or pass `--force`. |
| Deploy fails creating a service account or setting IAM policy | The deploying account lacks IAM permissions. See [Required IAM](#required-iam). |

Logs: `firebase functions:log --only kit-<instance-id>-handler --project <project-id>`.

## Billing

The kit uses Cloud Functions, Cloud Firestore, Secret Manager, Cloud Build and Artifact Registry, and optionally Firebase Authentication and Eventarc. Each has a free tier; low-volume apps usually stay within it. See [Firebase pricing](https://firebase.google.com/pricing).

## Reporting issues

[github.com/RevenueCat/firestore-revenuecat-purchases/issues](https://github.com/RevenueCat/firestore-revenuecat-purchases/issues)

## License

Apache-2.0
