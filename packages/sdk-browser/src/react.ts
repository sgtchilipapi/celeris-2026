import { useMemo } from "react";
import { createCelerisBrowserClient, type CelerisBrowserClientConfig } from "./index";

export function useCelerisBrowserClient(config: CelerisBrowserClientConfig | null | undefined) {
  const appId = config?.appId ?? "";
  const redirectUri = config?.redirectUri;
  const suiRpcOrigin = config?.suiRpcOrigin;

  return useMemo(() => {
    if (!config || !appId.trim()) {
      return null;
    }

    return createCelerisBrowserClient({
      appId,
      redirectUri: redirectUri ?? "",
      suiRpcOrigin
    });
  }, [appId, redirectUri, suiRpcOrigin]);
}
