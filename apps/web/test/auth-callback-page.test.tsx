import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallbackPage from "../app/auth/callback/page";

const sdkMocks = vi.hoisted(() => {
  const handleRedirectCallbackMock = vi.fn();
  const createCelerisBrowserClientMock = vi.fn(() => ({
    auth: {
      handleRedirectCallback: handleRedirectCallbackMock
    }
  }));

  return {
    createCelerisBrowserClientMock,
    handleRedirectCallbackMock
  };
});

vi.mock("@celeris/sdk-browser", () => ({
  createCelerisBrowserClient: sdkMocks.createCelerisBrowserClientMock
}));

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    sdkMocks.handleRedirectCallbackMock.mockResolvedValue({});
    sdkMocks.createCelerisBrowserClientMock.mockClear();
    sdkMocks.handleRedirectCallbackMock.mockClear();
    window.history.pushState(
      {},
      "",
      "/auth/callback?clientKind=app_consumer&appId=app_123&code=code_123&state=state_123"
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delegates app-consumer callback exchange to the public browser SDK", async () => {
    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(sdkMocks.createCelerisBrowserClientMock).toHaveBeenCalledWith({
        appId: "app_123",
        redirectUri: "https://demo.celeris.pro/auth/callback"
      });
    });
    expect(sdkMocks.handleRedirectCallbackMock).toHaveBeenCalledWith(window.location.href);
    expect(window.sessionStorage.getItem("celeris.demo.appId")).toBe("app_123");
  });
});
