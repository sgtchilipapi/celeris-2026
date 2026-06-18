"use client";

import { useEffect, useState } from "react";
import { authLoginRequestResponseSchema } from "@celeris/shared";
import { getWebRuntimeConfig } from "../env";
import { buttonVariants } from "./ui/button";
import { Card } from "./ui/card";

export function HostedSignIn() {
  const config = getWebRuntimeConfig();
  const [loginRequestId, setLoginRequestId] = useState<string>("");
  const [clientName, setClientName] = useState("Celeris");
  const [googleStartUrl, setGoogleStartUrl] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState("Load or create a login request to continue.");
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
      setStatusMessage("Login request ready.");
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
      setStatusMessage("Login request ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create login request");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="shell">
      <Card className="hero">
        <p className="eyebrow">POWERED BY CELERIS</p>
        <h1>Sign in to {clientName}</h1>
        <p className="lede">
          You are about to have a smooth blockchain experience.
        </p>

        <h2>Choose how you want to Sign-in.</h2>
        <a className={buttonVariants({ className: isBusy || !loginRequestId ? "disabled" : undefined })} href={googleStartUrl || "#"}>
          Continue with Google
        </a>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </Card>
    </main>
  );
}
