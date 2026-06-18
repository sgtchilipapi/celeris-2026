import {
  authLoginRequestResponseSchema,
  authSessionResponseSchema,
  creditsPricingResponseSchema,
  developerAppListResponseSchema,
  developerAppResponseSchema,
  developerProfileResponseSchema,
  managedActionResponseSchema,
  meResponseSchema,
  registerProgramSchema,
  registeredProgramResponseSchema,
  sponsorWalletResponseSchema,
  type ConfigureCreditsPricingInput,
  type ConfigureSayHelloInput,
  type CreateAuthLoginRequestInput,
  type CreateDeveloperAppInput
} from "@celeris/shared";

export interface CelerisServerClientConfig {
  apiOrigin: string;
  token?: string;
}

export interface CelerisServerClientOptions extends CelerisServerClientConfig {}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return payload;
}

async function requestJson<TResponse>(
  config: CelerisServerClientOptions,
  path: string,
  init: RequestInit,
  parser: { parse: (value: unknown) => TResponse }
) {
  const response = await fetch(new URL(path, config.apiOrigin), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
      ...(init.headers ?? {})
    }
  });
  const payload = await parseResponse(response);
  return parser.parse(payload);
}

async function requestEmpty(config: CelerisServerClientOptions, path: string, init: RequestInit) {
  const response = await fetch(new URL(path, config.apiOrigin), {
    ...init,
    headers: {
      ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
      ...(init.headers ?? {})
    }
  });

  await parseResponse(response);
}

function withToken(config: CelerisServerClientOptions, token: string) {
  return {
    ...config,
    token
  };
}

export function createCelerisServerClient(config: CelerisServerClientConfig) {
  return {
    config,
    auth: {
      createLoginRequest: async (input: CreateAuthLoginRequestInput) =>
        requestJson(
          config,
          "/v1/auth/login-requests",
          {
            method: "POST",
            body: JSON.stringify(input)
          },
          authLoginRequestResponseSchema
        ),
      exchangeToken: async (input: { code: string; state: string; email: string }) =>
        requestJson(
          config,
          "/v1/auth/token",
          {
            method: "POST",
            body: JSON.stringify(input)
          },
          authSessionResponseSchema
        ),
      getMe: async () =>
        requestJson(
          config,
          "/v1/me",
          {
            method: "GET"
          },
          meResponseSchema
        ),
      signOut: async () =>
        requestEmpty(config, "/v1/auth/logout", {
          method: "POST"
        })
    },
    developers: {
      getMe: async () =>
        requestJson(
          config,
          "/v1/developer/me",
          {
            method: "GET"
          },
          developerProfileResponseSchema
        ),
      ensureProfile: async () =>
        requestJson(
          config,
          "/v1/developer/profile",
          {
            method: "POST"
          },
          developerProfileResponseSchema
        )
    },
    apps: {
      list: async () =>
        requestJson(
          config,
          "/v1/developer/apps",
          {
            method: "GET"
          },
          developerAppListResponseSchema
        ),
      create: async (input: CreateDeveloperAppInput) =>
        requestJson(
          config,
          "/v1/developer/apps",
          {
            method: "POST",
            body: JSON.stringify(input)
          },
          developerAppResponseSchema
        ),
      get: async (appId: string) =>
        requestJson(
          config,
          `/v1/developer/apps/${appId}`,
          {
            method: "GET"
          },
          developerAppResponseSchema
        ),
      provisionSponsorWallet: async (appId: string) =>
        requestJson(
          config,
          `/v1/developer/apps/${appId}/sponsor-wallet`,
          {
            method: "POST"
          },
          sponsorWalletResponseSchema
        ),
      getSponsorWallet: async (appId: string) =>
        requestJson(
          config,
          `/v1/developer/apps/${appId}/sponsor-wallet`,
          {
            method: "GET"
          },
          sponsorWalletResponseSchema
        ),
      registerProgram: async (appId: string, input: Parameters<typeof registerProgramSchema.parse>[0]) =>
        requestJson(
          config,
          `/v1/developer/apps/${appId}/program`,
          {
            method: "PUT",
            body: JSON.stringify(input)
          },
          registeredProgramResponseSchema
        ),
      getProgram: async (appId: string) =>
        requestJson(
          config,
          `/v1/developer/apps/${appId}/program`,
          {
            method: "GET"
          },
          registeredProgramResponseSchema
        ),
      configureSayHello: async (appId: string, input: ConfigureSayHelloInput) =>
        requestJson(
          config,
          `/v1/developer/apps/${appId}/actions/say_hello`,
          {
            method: "PUT",
            body: JSON.stringify(input)
          },
          managedActionResponseSchema
        ),
      configureCreditsPricing: async (appId: string, input: ConfigureCreditsPricingInput) =>
        requestJson(
          config,
          `/v1/developer/apps/${appId}/credits-pricing`,
          {
            method: "PUT",
            body: JSON.stringify(input)
          },
          creditsPricingResponseSchema
        )
    },
    withToken(token: string) {
      return createCelerisServerClient(withToken(config, token));
    }
  };
}
