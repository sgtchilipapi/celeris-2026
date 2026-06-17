export type WebSurface = "developer-app" | "demo" | "hosted-auth" | "unknown";

export interface SurfaceConfig {
  developerAppOrigin: string;
  demoFrontendOrigin: string;
  hostedAuthOrigin: string;
}

function toHost(origin: string) {
  return new URL(origin).host;
}

export function resolveWebSurface(host: string | null | undefined, config: SurfaceConfig): WebSurface {
  if (!host) {
    return "unknown";
  }

  if (host === toHost(config.developerAppOrigin)) {
    return "developer-app";
  }

  if (host === toHost(config.demoFrontendOrigin)) {
    return "demo";
  }

  if (host === toHost(config.hostedAuthOrigin)) {
    return "hosted-auth";
  }

  return "unknown";
}
