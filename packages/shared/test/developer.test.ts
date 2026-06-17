import { describe, expect, it } from "vitest";
import { deriveZkLoginSalt } from "../src/developer";

describe("deriveZkLoginSalt", () => {
  it("derives a stable salt that fits the zkLogin prover 16-byte limit", () => {
    const salt = deriveZkLoginSalt("test-seed", "https://accounts.google.com", "google-subject");

    expect(salt).toBe(deriveZkLoginSalt("test-seed", "https://accounts.google.com", "google-subject"));
    expect(BigInt(salt)).toBeLessThan(2n ** 128n);
  });

  it("derives different salts for different subjects", () => {
    expect(deriveZkLoginSalt("test-seed", "https://accounts.google.com", "subject-a")).not.toBe(
      deriveZkLoginSalt("test-seed", "https://accounts.google.com", "subject-b")
    );
  });
});
