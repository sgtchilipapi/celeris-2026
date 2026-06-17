import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DeveloperSetupConsole } from "../../../src/components/developer-setup-console";
import { getWebRuntimeConfig } from "../../../src/env";
import { resolveWebSurface } from "../../../src/surface";

export default async function DeveloperSetupPage() {
  const config = getWebRuntimeConfig();
  const headerStore = await headers();
  const surface = resolveWebSurface(headerStore.get("host"), {
    developerAppOrigin: config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN,
    demoFrontendOrigin: config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN,
    hostedAuthOrigin: config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN
  });

  if (surface === "demo") {
    return redirect("/");
  }

  if (surface === "hosted-auth") {
    return redirect("/sign-in");
  }

  return (
    <DeveloperSetupConsole
      apiOrigin={config.NEXT_PUBLIC_API_ORIGIN}
      hostedAuthOrigin={config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN}
      developerAppOrigin={config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN}
      demoOrigin={config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN}
    />
  );
}
