import { describe, expect, it } from "vitest";
import {
  HELLO_CELERIS_CLOCK_OBJECT_ID,
  HELLO_CELERIS_MAX_USERNAME_UTF8_BYTES,
  assertHelloCelerisSayHelloTransactionKindMatches,
  buildCanonicalHelloCelerisSayHelloTransaction,
  buildHelloCelerisSayHelloTransaction,
  normalizeHelloCelerisUsername,
  parseSuiObjectId,
  parseSuiPackageId
} from "../../src/sui/hello-celeris.ts";

const PACKAGE_ID = "0x2";
const APP_STATE_OBJECT_ID = "0x123";
const APP_AUTHORITY_CAP_OBJECT_ID = "0x456";

describe("hello-celeris helpers", () => {
  it("trims usernames and enforces the maximum UTF-8 size", () => {
    expect(normalizeHelloCelerisUsername("  Sam  ")).toBe("Sam");
    expect(() => normalizeHelloCelerisUsername("x".repeat(HELLO_CELERIS_MAX_USERNAME_UTF8_BYTES + 1))).toThrow(
      /at most 32 UTF-8 bytes/
    );
  });

  it("parses package and object IDs and rejects malformed values", () => {
    expect(parseSuiPackageId(PACKAGE_ID)).toBe("0x0000000000000000000000000000000000000000000000000000000000000002");
    expect(parseSuiObjectId(APP_STATE_OBJECT_ID)).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000123"
    );
    expect(() => parseSuiPackageId("not-a-package")).toThrow(/Invalid Sui package ID/);
    expect(() => parseSuiObjectId("xyz")).toThrow(/Invalid Sui object ID/);
  });

  it("emits the canonical move call and arguments", () => {
    const { transactionKind, normalizedUsername, message } = buildHelloCelerisSayHelloTransaction({
      packageId: PACKAGE_ID,
      appAuthorityCapObjectId: APP_AUTHORITY_CAP_OBJECT_ID,
      appStateObjectId: APP_STATE_OBJECT_ID,
      username: "  Sam  "
    });
    const transactionData = transactionKind as {
      commands: Array<{
        MoveCall: {
          package: string;
          module: string;
          function: string;
          arguments: Array<{ Input: number; type: string }>;
        };
      }>;
      inputs: unknown[];
    };
    const inputs = transactionData.inputs as Array<Record<string, unknown>>;

    expect(normalizedUsername).toBe("Sam");
    expect(message).toBe("Sam says Hello Celeris!");
    expect(transactionData.commands).toHaveLength(1);
    expect(transactionData.commands[0].MoveCall.package).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000002"
    );
    expect(transactionData.commands[0].MoveCall.module).toBe("hello_celeris");
    expect(transactionData.commands[0].MoveCall.function).toBe("say_hello");
    expect(transactionData.commands[0].MoveCall.arguments).toEqual([
      { Input: 0, type: "object", $kind: "Input" },
      { Input: 1, type: "object", $kind: "Input" },
      { Input: 2, type: "object", $kind: "Input" },
      { Input: 3, type: "pure", $kind: "Input" }
    ]);
    expect((inputs[0].UnresolvedObject as { objectId: string }).objectId).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000456"
    );
    expect((inputs[1].UnresolvedObject as { objectId: string }).objectId).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000123"
    );
    expect((inputs[2].UnresolvedObject as { objectId: string }).objectId).toBe(HELLO_CELERIS_CLOCK_OBJECT_ID);
    expect(inputs[3]).toEqual({ Pure: { bytes: "A1NhbQ==" }, $kind: "Pure" });
  });

  it("rejects mismatched transaction payloads and object references", () => {
    const { transaction } = buildHelloCelerisSayHelloTransaction({
      packageId: PACKAGE_ID,
      appAuthorityCapObjectId: APP_AUTHORITY_CAP_OBJECT_ID,
      appStateObjectId: APP_STATE_OBJECT_ID,
      username: "Sam"
    });

    expect(() =>
      assertHelloCelerisSayHelloTransactionKindMatches(transaction, {
        packageId: PACKAGE_ID,
        appAuthorityCapObjectId: APP_AUTHORITY_CAP_OBJECT_ID,
        appStateObjectId: APP_STATE_OBJECT_ID,
        username: "Sam"
      })
    ).not.toThrow();

    expect(() =>
      assertHelloCelerisSayHelloTransactionKindMatches(transaction, {
        packageId: PACKAGE_ID,
        appAuthorityCapObjectId: APP_AUTHORITY_CAP_OBJECT_ID,
        appStateObjectId: APP_STATE_OBJECT_ID,
        username: "Alex"
      })
    ).toThrow(/does not exactly match/);

    expect(() =>
      assertHelloCelerisSayHelloTransactionKindMatches(transaction, {
        packageId: PACKAGE_ID,
        appAuthorityCapObjectId: "0x789",
        appStateObjectId: APP_STATE_OBJECT_ID,
        username: "Sam"
      })
    ).toThrow(/does not exactly match/);
  });

  it("accepts registered program metadata and player wallet context", () => {
    const built = buildCanonicalHelloCelerisSayHelloTransaction({
      registeredProgram: {
        packageId: PACKAGE_ID,
        authorityCapObjectId: APP_AUTHORITY_CAP_OBJECT_ID,
        appStateObjectId: APP_STATE_OBJECT_ID
      },
      playerWalletAddress: "0xabc",
      username: "  Sam  "
    });

    expect(built.playerWalletAddress).toBe("0x0000000000000000000000000000000000000000000000000000000000000abc");
    expect(built.normalizedUsername).toBe("Sam");
    expect(built.message).toBe("Sam says Hello Celeris!");
  });
});
