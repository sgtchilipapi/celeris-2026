import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "../app/sign-in/page";

const fetchMock = vi.fn<typeof fetch>();

describe("SignInPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Google sign-in without exposing the mock identity form", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          loginRequest: {
            loginRequestId: "login_123",
            clientKind: "developer_dashboard",
            clientId: "celeris-dashboard",
            appId: null,
            redirectUri: "http://localhost:3101/auth/callback",
            state: "state_123",
            nonce: "nonce_123",
            maxEpoch: 2,
            expiresAt: "2026-06-30T00:00:00.000Z",
            authUrl: "http://localhost:3101/sign-in?loginRequestId=login_123"
          }
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    render(<SignInPage />);

    const googleLink = await screen.findByRole("link", { name: "Continue with Google" });

    expect(googleLink).toHaveAttribute(
      "href",
      "https://api.celeris.pro/v1/auth/google/start?loginRequestId=login_123"
    );
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        new URL("/v1/auth/login-requests", "https://api.celeris.pro"),
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });
});
