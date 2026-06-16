import { DeveloperSetupConsole } from "../../../src/components/developer-setup-console";
import { getWebRuntimeConfig } from "../../../src/env";

export default function DeveloperSetupPage() {
  const config = getWebRuntimeConfig();

  return (
    <DeveloperSetupConsole
      apiOrigin={config.NEXT_PUBLIC_API_ORIGIN}
      hostedAuthOrigin={config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN}
    />
  );
}
