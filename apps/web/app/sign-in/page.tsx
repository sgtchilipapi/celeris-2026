"use client";

import { useEffect, useState } from "react";
import { authLoginRequestResponseSchema } from "@celeris/shared";
import { getWebRuntimeConfig } from "../../src/env";

export default function SignInPage() {
  const config = getWebRuntimeConfig();
  const [loginRequestId, setLoginRequestId] = useState<string>("");
  const [googleStartUrl, setGoogleStartUrl] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState("Load or create a login request to continue.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existingRequestId = params.get("loginRequestId");

    if (existingRequestId) {
      setLoginRequestId(existingRequestId);
      setGoogleStartUrl(new URL(`/v1/auth/google/start?loginRequestId=${existingRequestId}`, config.NEXT_PUBLIC_API_ORIGIN).toString());
      return;
    }

    void createLoginRequest();
  }, []);

  async function createLoginRequest() {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams(window.location.search);
      const redirectUri =
        params.get("redirectUri") ?? new URL("/auth/callback", config.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN).toString();
      const response = await fetch(new URL("/v1/auth/login-requests", config.NEXT_PUBLIC_API_ORIGIN), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          clientKind: "developer_dashboard",
          clientId: "celeris-dashboard",
          redirectUri
        })
      });
      const payload = authLoginRequestResponseSchema.parse(await response.json());
      setLoginRequestId(payload.loginRequest.loginRequestId);
      setGoogleStartUrl(
        new URL(`/v1/auth/google/start?loginRequestId=${payload.loginRequest.loginRequestId}`, config.NEXT_PUBLIC_API_ORIGIN).toString()
      );
      setStatusMessage("Login request ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create login request");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Shared Auth</p>
        <h1>Developer sign-in</h1>
        <p className="lede">
          This auth origin hosts Google sign-in for the reserved first-party dashboard client and app consumers.
        </p>
      </section>

      <section className="panel">
        <h2>Dashboard login request</h2>
        <p>{statusMessage}</p>
        <p>{loginRequestId || "Pending request creation"}</p>
      </section>

      <section className="panel">
        <h2>Google sign-in</h2>
        <a className={`button${isBusy || !loginRequestId ? " disabled" : ""}`} href={googleStartUrl || "#"}>
          Continue with Google
        </a>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
