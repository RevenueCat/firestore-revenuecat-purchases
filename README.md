## RevenueCat Firebase extension

TODO

## Installing the extension in our test project

```
firebase ext:install . --project revenuecat-1567550268644
```

## Testing

Open one tab and run

```
SHARED_SECRET=test_secret node development/signer-server.js
```

Then another and run

```
firebase ext:dev:emulators:start --project=revenuecat-1567550268644 --test-params=functions/.env.test
```

Now can issue requests in Postman. These Postman requests will automatically inject the JWT signature 

https://go.postman.co/workspace/New-Personal-Workspace~f51e51f8-df31-405c-9dbb-1021814dc0b9/collection/19096815-2b5e6159-c5da-4f07-b51c-eeaf2e08868e


## Deployment in our test project

firebase ext:install . --project revenuecat-1567550268644