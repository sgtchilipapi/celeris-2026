import { parseWebEnv } from "@celeris/shared";

type WebRuntimeConfig = ReturnType<typeof parseWebEnv>;

const tunnelRuntimeConfig = {
  NEXT_PUBLIC_API_ORIGIN: "https://api.celeris.pro",
  NEXT_PUBLIC_DEVELOPER_APP_ORIGIN: "https://app.celeris.pro",
  NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN: "https://demo.celeris.pro",
  NEXT_PUBLIC_HOSTED_AUTH_ORIGIN: "https://auth.celeris.pro",
  NEXT_PUBLIC_SUI_RPC_ORIGIN: "https://fullnode.testnet.sui.io:443"
} as const;

function isLocalOrigin(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isCelerisTunnelHost(hostname: string | undefined) {
  return Boolean(hostname?.endsWith(".celeris.pro"));
}

export function normalizeWebRuntimeConfigForHost(config: WebRuntimeConfig, hostname: string | undefined) {
  if (!isCelerisTunnelHost(hostname)) {
    return config;
  }

  return {
    ...config,
    NEXT_PUBLIC_API_ORIGIN: isLocalOrigin(config.NEXT_PUBLIC_API_ORIGIN)
      ? tunnelRuntimeConfig.NEXT_PUBLIC_API_ORIGIN
      : config.NEXT_PUBLIC_API_ORIGIN,
    NEXT_PUBLIC_DEVELOPER_APP_ORIGIN: isLocalOrigin(config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN)
      ? tunnelRuntimeConfig.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN
      : config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN,
    NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN: isLocalOrigin(config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN)
      ? tunnelRuntimeConfig.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN
      : config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN,
    NEXT_PUBLIC_HOSTED_AUTH_ORIGIN: isLocalOrigin(config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN)
      ? tunnelRuntimeConfig.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN
      : config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN,
    NEXT_PUBLIC_SUI_RPC_ORIGIN: config.NEXT_PUBLIC_SUI_RPC_ORIGIN
  };
}

export function getWebRuntimeConfig() {
  return normalizeWebRuntimeConfigForHost(
    parseWebEnv(process.env),
    typeof window === "undefined" ? undefined : window.location.hostname
  );
}
