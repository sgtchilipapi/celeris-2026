import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCelerisBrowserClient } from "../src";

const fetchMock = vi.fn<typeof fetch>();

function createSession(token = "token-123") {
  return {
    token,
    expiresAt: "2026-06-30T00:00:00.000Z",
    clientKind: "app_consumer",
    clientId: "app_123",
    appId: "app_123",
    user: {
      id: "user_1",
      email: "user@example.com",
      walletAddress: "0x2c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011"
    },
    developerProfile: null,
    zkLogin: null
  };
}

describe("Celeris browser SDK auth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates app-scoped login requests and stores ephemeral material in sessionStorage", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          loginRequest: {
            loginRequestId: "login_123",
            clientKind: "app_consumer",
            clientId: "app_123",
            appId: "app_123",
            redirectUri: "http://localhost:3103/auth/callback",
            state: "state_123",
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

    const client = createCelerisBrowserClient({
      appId: "app_123",
      apiOrigin: "http://localhost:4100",
      hostedAuthOrigin: "http://localhost:3101",
      redirectUri: "http://localhost:3103/auth/callback"
    });
    const loginRequest = await client.auth.startLogin({ redirect: false });

    expect(loginRequest.loginRequestId).toBe("login_123");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/v1/auth/login-requests", "http://localhost:4100"),
      expect.objectContaining({
        method: "POST",
        body: expect.any(String)
      })
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      clientKind: "app_consumer",
      clientId: "app_123",
      appId: "app_123",
      redirectUri: "http://localhost:3103/auth/callback",
      zkLogin: {
        nonce: expect.any(String),
        extendedEphemeralPublicKey: expect.any(String),
        maxEpoch: expect.any(Number),
        jwtRandomness: expect.any(String)
      }
    });
    expect(window.sessionStorage.getItem("celeris.zklogin.ephemeral.app_123")).toContain("extendedEphemeralPublicKey");
    expect(window.localStorage.length).toBe(0);
  });

  it("exchanges callback parameters and refreshes the stored session", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: createSession() }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: createSession("token-refreshed") }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      );

    const client = createCelerisBrowserClient({
      appId: "app_123",
      apiOrigin: "http://localhost:4100",
      hostedAuthOrigin: "http://localhost:3101",
      redirectUri: "http://localhost:3103/auth/callback"
    });

    const session = await client.auth.handleRedirectCallback(
      "http://localhost:3103/auth/callback?code=code_123&state=state_123"
    );

    expect(session.user.email).toBe("user@example.com");
    expect(window.sessionStorage.getItem("celeris.auth.session.app_123")).toContain("token-123");

    const refreshed = await client.auth.getSession();

    expect(refreshed?.token).toBe("token-refreshed");
    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("/v1/me", "http://localhost:4100"),
      expect.objectContaining({
        headers: {
          authorization: "Bearer token-123"
        }
      })
    );
  });

  it("signs out and clears session-scoped auth state", async () => {
    window.sessionStorage.setItem("celeris.auth.session.app_123", JSON.stringify(createSession()));
    window.sessionStorage.setItem("celeris.zklogin.ephemeral.app_123", "{}");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const client = createCelerisBrowserClient({
      appId: "app_123",
      apiOrigin: "http://localhost:4100",
      hostedAuthOrigin: "http://localhost:3101",
      redirectUri: "http://localhost:3103/auth/callback"
    });

    await client.auth.signOut();

    expect(window.sessionStorage.getItem("celeris.auth.session.app_123")).toBeNull();
    expect(window.sessionStorage.getItem("celeris.zklogin.ephemeral.app_123")).toBeNull();
  });

  it("fetches catalog, balance, and checkout through the public app APIs", async () => {
    window.sessionStorage.setItem("celeris.auth.session.app_123", JSON.stringify(createSession()));
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            catalog: {
              appId: "app_123",
              chainId: "sui:testnet",
              actions: [
                {
                  actionType: "say_hello",
                  priceCredits: 5,
                  isEnabled: true
                }
              ]
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: createSession() }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            balance: {
              appId: "app_123",
              walletAddress: createSession().user.walletAddress,
              chainId: "sui:testnet",
              availableCredits: 100
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: createSession() }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            checkoutSession: {
              checkoutSessionId: "checkout_123",
              appId: "app_123",
              walletAddress: createSession().user.walletAddress,
              chainId: "sui:testnet",
              credits: 50,
              status: "pending",
              checkoutUrl: "http://localhost:3103/checkout?appId=app_123&checkoutSessionId=checkout_123",
              successRedirectUrl: "http://localhost:3103/?checkout=success",
              cancelRedirectUrl: "http://localhost:3103/?checkout=canceled",
              createdAt: "2026-06-30T00:00:00.000Z",
              updatedAt: "2026-06-30T00:00:00.000Z"
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

    const client = createCelerisBrowserClient({
      appId: "app_123",
      apiOrigin: "http://localhost:4100",
      hostedAuthOrigin: "http://localhost:3101",
      redirectUri: "http://localhost:3103/auth/callback"
    });

    await expect(client.apps.getCatalog()).resolves.toMatchObject({
      actions: [
        {
          actionType: "say_hello",
          priceCredits: 5
        }
      ]
    });
    await expect(client.credits.getBalance()).resolves.toMatchObject({
      availableCredits: 100
    });
    await expect(client.credits.startCheckout({ credits: 50, redirect: false })).resolves.toMatchObject({
      checkoutSessionId: "checkout_123",
      status: "pending"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/v1/apps/app_123/balance", "http://localhost:4100"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer token-123"
        })
      })
    );
  });

  it("completes checkout and returns the refreshed ledger balance", async () => {
    window.sessionStorage.setItem("celeris.auth.session.app_123", JSON.stringify(createSession()));
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: createSession() }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            checkoutSession: {
              checkoutSessionId: "checkout_123",
              appId: "app_123",
              walletAddress: createSession().user.walletAddress,
              chainId: "sui:testnet",
              credits: 50,
              status: "completed",
              checkoutUrl: "http://localhost:3103/checkout?appId=app_123&checkoutSessionId=checkout_123",
              successRedirectUrl: "http://localhost:3103/?checkout=success",
              cancelRedirectUrl: "http://localhost:3103/?checkout=canceled",
              createdAt: "2026-06-30T00:00:00.000Z",
              updatedAt: "2026-06-30T00:00:00.000Z"
            },
            balance: {
              appId: "app_123",
              walletAddress: createSession().user.walletAddress,
              chainId: "sui:testnet",
              availableCredits: 50
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    const client = createCelerisBrowserClient({
      appId: "app_123",
      apiOrigin: "http://localhost:4100",
      hostedAuthOrigin: "http://localhost:3101",
      redirectUri: "http://localhost:3103/auth/callback"
    });

    await expect(client.credits.completeCheckout("checkout_123")).resolves.toMatchObject({
      checkoutSession: {
        status: "completed"
      },
      balance: {
        availableCredits: 50
      }
    });
  });
});
