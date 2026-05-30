export interface CelerisServerClientConfig {
  apiOrigin: string;
  token?: string;
}

function notImplemented(methodName: string): never {
  throw new Error(`${methodName} is not implemented in FS-00`);
}

export function createCelerisServerClient(config: CelerisServerClientConfig) {
  return {
    config,
    developers: {
      signUp: async () => notImplemented("developers.signUp"),
      signIn: async () => notImplemented("developers.signIn")
    },
    apps: {
      create: async () => notImplemented("apps.create"),
      get: async () => notImplemented("apps.get"),
      provisionSponsorWallet: async () => notImplemented("apps.provisionSponsorWallet"),
      registerProgram: async () => notImplemented("apps.registerProgram"),
      configureSayHello: async () => notImplemented("apps.configureSayHello")
    }
  };
}
