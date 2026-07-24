import { describe, expect, test } from "bun:test";

type PackageContract = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

const packageContract = (await Bun.file(
  new URL("../package.json", import.meta.url),
).json()) as PackageContract;

describe("Wallet dependency ownership", () => {
  test("uses one host-owned Wallet and transitive Agency runtime", () => {
    expect(packageContract.dependencies?.["@absolutejs/wallet"]).toBeUndefined();
    expect(packageContract.peerDependencies?.["@absolutejs/wallet"]).toBe(
      ">=0.9.1 <0.10.0",
    );
    expect(packageContract.devDependencies?.["@absolutejs/wallet"]).toBe(
      "0.9.1",
    );
    expect(packageContract.devDependencies?.["@absolutejs/agency"]).toBe(
      "0.7.1",
    );
    expect(packageContract.scripts?.build).toContain(
      "--external @absolutejs/wallet",
    );
  });
});
