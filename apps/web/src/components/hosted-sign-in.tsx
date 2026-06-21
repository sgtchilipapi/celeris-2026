"use client";

import { useEffect, useState } from "react";
import { authLoginRequestResponseSchema } from "@celeris/shared";
import { getWebRuntimeConfig } from "../env";
import { buttonVariants } from "./ui/button";

export function HostedSignIn() {
  const config = getWebRuntimeConfig();
  const [loginRequestId, setLoginRequestId] = useState<string>("");
  const [clientName, setClientName] = useState("Celeris");
  const [googleStartUrl, setGoogleStartUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existingRequestId = params.get("loginRequestId");

    if (existingRequestId) {
      void loadLoginRequest(existingRequestId);
      return;
    }

    void createLoginRequest();
  }, []);

  async function loadLoginRequest(existingRequestId: string) {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const response = await fetch(new URL(`/v1/auth/login-requests/${existingRequestId}`, config.NEXT_PUBLIC_API_ORIGIN));
      const payload = authLoginRequestResponseSchema.parse(await response.json());
      setLoginRequestId(payload.loginRequest.loginRequestId);
      setClientName(payload.loginRequest.clientName);
      setGoogleStartUrl(
        new URL(`/v1/auth/google/start?loginRequestId=${payload.loginRequest.loginRequestId}`, config.NEXT_PUBLIC_API_ORIGIN).toString()
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load login request");
    } finally {
      setIsBusy(false);
    }
  }

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
      setClientName(payload.loginRequest.clientName);
      setGoogleStartUrl(
        new URL(`/v1/auth/google/start?loginRequestId=${payload.loginRequest.loginRequestId}`, config.NEXT_PUBLIC_API_ORIGIN).toString()
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create login request");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-orbit" aria-hidden="true" />
        <div className="grid gap-7">
          <div className="grid gap-3">
            <p className="auth-kicker">Celeris Auth</p>
            <h1 className="m-0 text-2xl font-semibold leading-tight sm:text-3xl">
              Sign in to {clientName}
            </h1>
            <p className="auth-copy">
              Continue with Google to create a secure zkLogin session for this Celeris surface.
            </p>
          </div>

          <a
            aria-disabled={isBusy || !loginRequestId}
            className={buttonVariants({
              className: `auth-google-button w-full ${
                isBusy || !loginRequestId ? "disabled" : ""
              }`
            })}
            href={googleStartUrl || "#"}
          >
            Continue with Google
          </a>
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
