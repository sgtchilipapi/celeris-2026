import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeShell } from "../src/components/home-shell";

describe("HomeShell", () => {
  it("renders the bootstrap runtime values", () => {
    render(
      <HomeShell
        mode="demo"
        config={{
          apiOrigin: "http://localhost:4000",
          hostedAuthOrigin: "http://localhost:3100"
        }}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Demo App Shell" })).toBeInTheDocument();
    expect(screen.getByText("http://localhost:4000")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:3100")).toBeInTheDocument();
  });
});
