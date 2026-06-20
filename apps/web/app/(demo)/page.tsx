import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CelerisLandingPage } from "../../src/components/celeris-landing-page";
import { DeveloperSetupConsole } from "../../src/components/developer-setup-console";
import { DemoConsumerShell } from "../../src/components/demo-consumer-shell";
import { getWebRuntimeConfig } from "../../src/env";
import { resolveWebSurface } from "../../src/surface";

export default async function SurfaceRootPage() {
  const config = getWebRuntimeConfig();
  const headerStore = await headers();
  const surface = resolveWebSurface(headerStore.get("host"), {
    developerAppOrigin: config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN,
    demoFrontendOrigin: config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN,
    hostedAuthOrigin: config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN
  });

  if (surface === "developer-app") {
    return (
      <DeveloperSetupConsole
        apiOrigin={config.NEXT_PUBLIC_API_ORIGIN}
        hostedAuthOrigin={config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN}
        developerAppOrigin={config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN}
        demoOrigin={config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN}
      />
    );
  }

  if (surface === "demo") {
    return <DemoConsumerShell />;
  }

  if (surface === "hosted-auth") {
    return redirect("/sign-in");
  }

  return <CelerisLandingPage />;
}
