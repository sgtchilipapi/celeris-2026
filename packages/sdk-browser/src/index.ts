export interface CelerisBrowserClientConfig {
  appId: string;
  apiOrigin: string;
  hostedAuthOrigin: string;
  redirectUri: string;
  suiRpcOrigin?: string;
}

function notImplemented(methodName: string): never {
  throw new Error(`${methodName} is not implemented in FS-00`);
}

export function createCelerisBrowserClient(config: CelerisBrowserClientConfig) {
  return {
    config,
    auth: {
      startLogin: async () => notImplemented("auth.startLogin"),
      handleRedirectCallback: async () => notImplemented("auth.handleRedirectCallback"),
      getSession: async () => notImplemented("auth.getSession"),
      signOut: async () => notImplemented("auth.signOut")
    },
    apps: {
      getCatalog: async () => notImplemented("apps.getCatalog")
    },
    credits: {
      getBalance: async () => notImplemented("credits.getBalance"),
      startCheckout: async () => notImplemented("credits.startCheckout")
    },
    actions: {
      sayHello: async (_input: { username: string }) => notImplemented("actions.sayHello")
    },
    transactions: {
      list: async () => notImplemented("transactions.list")
    }
  };
}
