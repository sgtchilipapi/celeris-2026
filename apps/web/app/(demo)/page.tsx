import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DeveloperSetupConsole } from "../../src/components/developer-setup-console";
import { DemoConsumerShell } from "../../src/components/demo-consumer-shell";
import { HomeShell } from "../../src/components/home-shell";
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
    return (
      <DemoConsumerShell
        apiOrigin={config.NEXT_PUBLIC_API_ORIGIN}
        hostedAuthOrigin={config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN}
        demoFrontendOrigin={config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN}
        initialAppId={config.NEXT_PUBLIC_DEMO_APP_ID}
      />
    );
  }

  if (surface === "hosted-auth") {
    return redirect("/sign-in");
  }

  return (
    <HomeShell
      mode="demo"
      config={{
        apiOrigin: config.NEXT_PUBLIC_API_ORIGIN,
        hostedAuthOrigin: config.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN,
        developerAppOrigin: config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN,
        demoFrontendOrigin: config.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN
      }}
    />
  );
}
