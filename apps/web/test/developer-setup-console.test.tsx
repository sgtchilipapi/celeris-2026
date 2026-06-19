import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeveloperSetupConsole } from "../src/components/developer-setup-console";

const fetchMock = vi.fn<typeof fetch>();

describe("DeveloperSetupConsole", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    window.sessionStorage.clear();
    document.cookie = "celeris_dashboard_session=; Path=/; Max-Age=0; SameSite=Lax";
    fetchMock.mockReset();
    window.sessionStorage.setItem("celeris.fs011.dashboard.token", "token-123");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the shared-auth dashboard session and creates an app through the public APIs", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              token: "token-123",
              expiresAt: "2026-06-30T00:00:00.000Z",
              clientKind: "developer_dashboard",
              clientId: "celeris-dashboard",
              appId: null,
              user: {
                id: "user_1",
                email: "dev@example.com",
                walletAddress: "0x2c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011"
              },
              developerProfile: {
                id: "profile_1",
                email: "dev@example.com",
                displayName: "Developer"
              },
              zkLogin: null
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
        new Response(
          JSON.stringify({
            apps: []
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
        new Response(
          JSON.stringify({
            app: {
              appId: "app_1",
              name: "Hello Celeris Demo",
              slug: "hello-celeris-demo-abcd1234",
              allowedChainId: "sui:testnet",
              authProvider: "zklogin",
              createdAt: "2026-06-16T00:00:00.000Z",
              updatedAt: "2026-06-16T00:00:00.000Z",
              sponsorWallet: null,
              registeredProgram: null,
              sayHelloAction: null,
              creditsPricing: {
                creditsPerUsd: 100,
                updatedAt: "2026-06-16T00:00:00.000Z"
              },
              sdkConfig: {
                appId: "app_1",
                allowedChainId: "sui:testnet",
                authProvider: "zklogin",
                apiOrigin: "http://localhost:4100",
                hostedAuthOrigin: "http://localhost:3101",
                demoOrigin: "http://localhost:3102"
              }
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

    render(
      <DeveloperSetupConsole
        apiOrigin="http://localhost:4100"
        hostedAuthOrigin="http://localhost:3101"
        developerAppOrigin="http://localhost:3103"
        demoOrigin="http://localhost:3102"
      />
    );

    const profileButton = await screen.findByRole("button", { name: "Developer profile" });
    expect(profileButton).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.click(profileButton);
    const profileMenu = screen.getByRole("menu");
    expect(within(profileMenu).getByText("dev@example.com")).toBeInTheDocument();
    expect(within(profileMenu).getByText("0x2c45...5a2011")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("App name"), {
      target: {
        value: "Hello Celeris Demo"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create app" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        new URL("/v1/developer/apps", "http://localhost:4100"),
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Hello Celeris Demo/ })).toBeInTheDocument();
    });
  });

  it("restores the dashboard token from the session cookie when sessionStorage is empty", async () => {
    window.sessionStorage.clear();
    document.cookie = "celeris_dashboard_session=token-cookie; Path=/; SameSite=Lax";

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              token: "token-cookie",
              expiresAt: "2026-06-30T00:00:00.000Z",
              clientKind: "developer_dashboard",
              clientId: "celeris-dashboard",
              appId: null,
              user: {
                id: "user_1",
                email: "dev@example.com",
                walletAddress: "0x2c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011"
              },
              developerProfile: {
                id: "profile_1",
                email: "dev@example.com",
                displayName: "Developer"
              },
              zkLogin: null
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
        new Response(
          JSON.stringify({
            apps: []
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    render(
      <DeveloperSetupConsole
        apiOrigin="http://localhost:4100"
        hostedAuthOrigin="http://localhost:3101"
        developerAppOrigin="http://localhost:3103"
        demoOrigin="http://localhost:3102"
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        new URL("/v1/me", "http://localhost:4100"),
        expect.objectContaining({
          headers: {
            authorization: "Bearer token-cookie"
          }
        })
      );
    });

    expect(window.sessionStorage.getItem("celeris.fs011.dashboard.token")).toBe("token-cookie");
  });

  it("configures app-wide credits purchase pricing through the developer API", async () => {
    const appPayload = {
      appId: "app_1",
      name: "Hello Celeris Demo",
      slug: "hello-celeris-demo-abcd1234",
      allowedChainId: "sui:testnet",
      authProvider: "zklogin",
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z",
      sponsorWallet: null,
      registeredProgram: null,
      sayHelloAction: null,
      creditsPricing: {
        creditsPerUsd: 100,
        updatedAt: "2026-06-16T00:00:00.000Z"
      },
      sdkConfig: {
        appId: "app_1",
        allowedChainId: "sui:testnet",
        authProvider: "zklogin",
        apiOrigin: "http://localhost:4100",
        hostedAuthOrigin: "http://localhost:3101",
        demoOrigin: "http://localhost:3102"
      }
    };

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              token: "token-123",
              expiresAt: "2026-06-30T00:00:00.000Z",
              clientKind: "developer_dashboard",
              clientId: "celeris-dashboard",
              appId: null,
              user: {
                id: "user_1",
                email: "dev@example.com",
                walletAddress: "0x2c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011"
              },
              developerProfile: {
                id: "profile_1",
                email: "dev@example.com",
                displayName: "Developer"
              },
              zkLogin: null
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
        new Response(JSON.stringify({ apps: [appPayload] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            creditsPricing: {
              creditsPerUsd: 500,
              updatedAt: "2026-06-16T00:00:00.000Z"
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
        new Response(
          JSON.stringify({
            app: {
              ...appPayload,
              creditsPricing: {
                creditsPerUsd: 500,
                updatedAt: "2026-06-16T00:00:00.000Z"
              }
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

    render(
      <DeveloperSetupConsole
        apiOrigin="http://localhost:4100"
        hostedAuthOrigin="http://localhost:3101"
        developerAppOrigin="http://localhost:3103"
        demoOrigin="http://localhost:3102"
      />
    );

    const creditsPerUsdInput = await screen.findByRole("spinbutton", { name: "Credits per 1$" });
    fireEvent.change(creditsPerUsdInput, {
      target: {
        value: "500"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save pricing" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        new URL("/v1/developer/apps/app_1/credits-pricing", "http://localhost:4100"),
        expect.objectContaining({
          body: JSON.stringify({
            creditsPerUsd: 500
          }),
          method: "PUT"
        })
      );
    });

    await screen.findByText("Updated credits pricing.");
  });

  it("creates and lists the configured say_hello user action through the developer API", async () => {
    const appPayload = {
      appId: "app_1",
      name: "Hello Celeris Demo",
      slug: "hello-celeris-demo-abcd1234",
      allowedChainId: "sui:testnet",
      authProvider: "zklogin",
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z",
      sponsorWallet: null,
      registeredProgram: null,
      sayHelloAction: null,
      creditsPricing: {
        creditsPerUsd: 100,
        updatedAt: "2026-06-16T00:00:00.000Z"
      },
      sdkConfig: {
        appId: "app_1",
        allowedChainId: "sui:testnet",
        authProvider: "zklogin",
        apiOrigin: "http://localhost:4100",
        hostedAuthOrigin: "http://localhost:3101",
        demoOrigin: "http://localhost:3102"
      }
    };
    const configuredAction = {
      actionType: "say_hello",
      priceCredits: 7,
      isEnabled: false,
      createdAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z"
    };

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              token: "token-123",
              expiresAt: "2026-06-30T00:00:00.000Z",
              clientKind: "developer_dashboard",
              clientId: "celeris-dashboard",
              appId: null,
              user: {
                id: "user_1",
                email: "dev@example.com",
                walletAddress: "0x2c45b9cf7d7c5fc33dbd0a1b5c14fffd7a74ac6f9ed6d7f2d881d7ec8e5a2011"
              },
              developerProfile: {
                id: "profile_1",
                email: "dev@example.com",
                displayName: "Developer"
              },
              zkLogin: null
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
        new Response(JSON.stringify({ apps: [appPayload] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sayHelloAction: configuredAction }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            app: {
              ...appPayload,
              sayHelloAction: configuredAction
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

    render(
      <DeveloperSetupConsole
        apiOrigin="http://localhost:4100"
        hostedAuthOrigin="http://localhost:3101"
        developerAppOrigin="http://localhost:3103"
        demoOrigin="http://localhost:3102"
      />
    );

    const actionNameInput = await screen.findByLabelText("Action name");
    expect(actionNameInput).toHaveValue("say_hello");
    await waitFor(() => {
      expect(screen.getByLabelText("Credit usage")).toHaveValue(5);
    });

    fireEvent.change(screen.getByLabelText("Credit usage"), {
      target: {
        value: "7"
      }
    });
    fireEvent.click(screen.getByLabelText("Enabled"));
    fireEvent.click(screen.getByRole("button", { name: "Create Action" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        new URL("/v1/developer/apps/app_1/actions/say_hello", "http://localhost:4100"),
        expect.objectContaining({
          body: JSON.stringify({
            priceCredits: 7,
            isEnabled: false
          }),
          method: "PUT"
        })
      );
    });

    await screen.findByText("Updated say_hello action.");
    expect(screen.getByText("say_hello")).toBeInTheDocument();
    expect(screen.getByText("cost: 7 credits")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "say_hello, cost: 7 credits, disabled" }));

    expect(screen.getByLabelText("Action name")).toHaveValue("say_hello");
    expect(screen.getByLabelText("Credit usage")).toHaveValue(7);
    expect(screen.getByLabelText("Enabled")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });
});
