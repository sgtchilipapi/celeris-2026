import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoConsumerShell } from "../src/components/demo-consumer-shell";

const fetchMock = vi.fn<typeof fetch>();
const demoAppId = "cmqmhhec100018gzd9ydquc9y";
const transactionDigest = "95iAHdPNb3Dsw5V7VeBvFkGLTVTdXefFPDg498gd5G6a";

const session = {
  token: "token-123",
  expiresAt: "2026-06-30T00:00:00.000Z",
  clientKind: "app_consumer",
  clientId: demoAppId,
  appId: demoAppId,
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
    window.sessionStorage.setItem(`celeris.auth.session.${demoAppId}`, JSON.stringify(session));
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
              appId: demoAppId,
              chainId: "sui:testnet",
              creditsPricing: {
                creditsPerUsd: 500,
                updatedAt: "2026-06-16T00:00:00.000Z"
              },
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
        new Response(
          JSON.stringify({
            transactions: [
              {
                transactionId: "tx_123",
                appId: demoAppId,
                actionType: "say_hello",
                walletAddress: session.user.walletAddress,
                chainId: "sui:testnet",
                metadata: {
                  username: "Ada",
                  message: "Ada says Hello Celeris!"
                },
                username: "Ada",
                message: "Ada says Hello Celeris!",
                digest: transactionDigest,
                explorerUrl: "https://suiexplorer.com/txblock/legacy-digest?network=testnet",
                status: "confirmed",
                confirmedAt: "2026-06-30T00:00:00.000Z",
                createdAt: "2026-06-30T00:00:00.000Z"
              }
            ]
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
              appId: demoAppId,
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

    render(<DemoConsumerShell appId={demoAppId} demoOrigin="https://demo.celeris.pro" />);

    await waitFor(() => {
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
    });

    expect(screen.getByText("100 credits")).toBeInTheDocument();
    expect(screen.getByText("Ada said Hello!")).toBeInTheDocument();
    expect(screen.queryByText(transactionDigest)).not.toBeInTheDocument();
    expect(screen.queryByText("tx_123")).not.toBeInTheDocument();

    const transactionLink = screen.getByRole("link", { name: "click to view transaction" });
    expect(transactionLink).toHaveAttribute("href", `https://suiscan.xyz/testnet/tx/${transactionDigest}`);
    expect(transactionLink).toHaveAttribute("target", "_blank");

    fireEvent.click(screen.getByRole("button", { name: "Buy credits" }));

    const dialog = screen.getByRole("dialog", { name: "Credits" });
    expect(within(dialog).getByText("100 credits")).toBeInTheDocument();
    expect(within(dialog).getByText("500 credits per $1")).toBeInTheDocument();
  });
});
