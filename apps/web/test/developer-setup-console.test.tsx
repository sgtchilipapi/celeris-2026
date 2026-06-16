import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeveloperSetupConsole } from "../src/components/developer-setup-console";

const fetchMock = vi.fn<typeof fetch>();

describe("DeveloperSetupConsole", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    window.sessionStorage.clear();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("can sign up and create an app through the public APIs", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            developer: {
              id: "dev_1",
              email: "dev@example.com"
            },
            token: "token-123",
            expiresAt: "2026-06-30T00:00:00.000Z"
          }),
          {
            status: 201,
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
              sdkConfig: {
                appId: "app_1",
                allowedChainId: "sui:testnet",
                authProvider: "zklogin",
                apiOrigin: "http://localhost:4100",
                hostedAuthOrigin: "http://localhost:3101"
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

    render(<DeveloperSetupConsole apiOrigin="http://localhost:4100" hostedAuthOrigin="http://localhost:3101" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: {
        value: "dev@example.com"
      }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: {
        value: "password-123"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create developer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        new URL("/v1/developer/sign-up", "http://localhost:4100"),
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Signed in as dev@example.com")).toBeInTheDocument();
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
});
