import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoConsumerShell } from "../src/components/demo-consumer-shell";

const fetchMock = vi.fn<typeof fetch>();

const session = {
  token: "token-123",
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

describe("DemoConsumerShell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    window.sessionStorage.clear();
    window.sessionStorage.setItem("celeris.auth.session.app_123", JSON.stringify(session));
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the SDK-backed signed-in demo state", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            catalog: {
              appId: "app_123",
              chainId: "sui:testnet",
              registeredProgram: null,
              actions: [
                {
                  actionType: "say_hello",
                  priceCredits: 7,
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
        new Response(JSON.stringify({ transactions: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session }), {
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
              walletAddress: session.user.walletAddress,
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
      );

    render(
      <DemoConsumerShell
        apiOrigin="http://localhost:4100"
        hostedAuthOrigin="http://localhost:3101"
        demoFrontendOrigin="http://localhost:3103"
        suiRpcOrigin="https://fullnode.testnet.sui.io:443"
        initialAppId="app_123"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
    });

    expect(screen.getByText("app_consumer:app_123")).toBeInTheDocument();
    expect(screen.getByText(session.user.walletAddress)).toBeInTheDocument();
    expect(screen.getByText("100 credits")).toBeInTheDocument();
    expect(screen.getByText("7 credits")).toBeInTheDocument();
  });
});
