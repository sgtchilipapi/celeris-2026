import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeShell } from "../src/components/home-shell";
import { resolveWebSurface } from "../src/surface";

describe("HomeShell", () => {
  it("renders the demo surface runtime values", () => {
    render(
      <HomeShell
        mode="demo"
        config={{
          apiOrigin: "http://localhost:4100",
          hostedAuthOrigin: "http://localhost:3100",
          developerAppOrigin: "http://localhost:3101",
          demoFrontendOrigin: "http://localhost:3102"
        }}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Hello Celeris Demo" })).toBeInTheDocument();
    expect(screen.getByText("http://localhost:4100")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:3100")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:3101")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:3102")).toBeInTheDocument();
  });

  it("resolves hosts into explicit surfaces", () => {
    expect(
      resolveWebSurface("app.celeris.pro", {
        developerAppOrigin: "https://app.celeris.pro",
        demoFrontendOrigin: "https://demo.celeris.pro",
        hostedAuthOrigin: "https://auth.celeris.pro"
      })
    ).toBe("developer-app");

    expect(
      resolveWebSurface("demo.celeris.pro", {
        developerAppOrigin: "https://app.celeris.pro",
        demoFrontendOrigin: "https://demo.celeris.pro",
        hostedAuthOrigin: "https://auth.celeris.pro"
      })
    ).toBe("demo");
  });
});
