import {
  type ConfigureSayHelloInput,
  type CreateDeveloperAppInput,
  type DeveloperCredentials,
  developerAppListResponseSchema,
  developerAppResponseSchema,
  developerSessionResponseSchema,
  managedActionResponseSchema,
  registerProgramSchema,
  sponsorWalletResponseSchema,
  registeredProgramResponseSchema
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
    developers: {
      signUp: async (input: DeveloperCredentials) =>
        requestJson(
          config,
          "/v1/developer/sign-up",
          {
            method: "POST",
            body: JSON.stringify(input)
          },
          developerSessionResponseSchema
        ),
      signIn: async (input: DeveloperCredentials) =>
        requestJson(
          config,
          "/v1/developer/sign-in",
          {
            method: "POST",
            body: JSON.stringify(input)
          },
          developerSessionResponseSchema
        ),
      signOut: async () =>
        requestEmpty(config, "/v1/developer/sign-out", {
          method: "POST"
        })
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
        )
    },
    withToken(token: string) {
      return createCelerisServerClient(withToken(config, token));
    }
  };
}
