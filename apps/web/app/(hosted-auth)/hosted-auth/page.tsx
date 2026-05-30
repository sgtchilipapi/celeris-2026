import { HomeShell } from "../../../src/components/home-shell";
import { getWebRuntimeConfig } from "../../../src/env";

export default function HostedAuthShellPage() {
  const config = getWebRuntimeConfig();

  return (
    <HomeShell
      mode="hosted-auth"
      config={{
        apiOrigin: config.NEXT_PUBLIC_API_ORIGIN,
        hostedAuthOrigin: config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN
      }}
    />
  );
}
