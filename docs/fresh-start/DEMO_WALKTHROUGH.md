# Demo Walkthrough

## 1. Create And Configure The Celeris App

1. Open the developer dashboard.

2. Sign in with Google through the hosted auth surface. In the setup console:

3. Create a new app with `allowedChainId=sui:testnet` and `authProvider=zklogin`.

4. Provision the sponsor wallet. (This shall be automatic upon app creation)

5. Fund the sponsor wallet with Sui testnet SUI (Dont show in demo. Just mention it.)

## 2. Register Program Metadata

1. Mention the deployed Sui package.

2. In the developer dashboard, register:

```text
packageId=<packageId>
appStateObjectId=<AppState object ID>
authorityCapObjectId=<AppAuthorityCap object ID>
```

3. Then configure metered app actions. For the reference demo, create or update `say_hello`, set a price such as `5` credits, and leave it enabled.

## 3. Configure the Demo App

1. npm install celeris

2. show import & simple usage of the celeris sdk

3. Mention publishing the demo app

## 4. Try the demo app as a user

1. Open the demo app

2. Login with celeris

3. Buy credits

4. Say hello

## List possible use-cases in the future
