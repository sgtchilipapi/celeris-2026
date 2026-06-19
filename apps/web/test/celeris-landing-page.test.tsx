import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CelerisLandingPage } from "../src/components/celeris-landing-page";

describe("CelerisLandingPage", () => {
  it("renders the public landing page copy and contact actions", () => {
    render(<CelerisLandingPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Credit-based blockchain usage for Sui dApps."
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Wallet setup. Gas funding. Transaction confusion.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Contact me" })).toHaveLength(2);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Celeris © 2026");
  });
});
