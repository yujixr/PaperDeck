import { describe, expect, it } from "vitest";
import { createJwt, hashPassword, verifyJwt, verifyPassword } from "../src/lib/crypto";

describe("Password hashing (PBKDF2)", () => {
  it("should hash and verify a password", async () => {
    const hash = await hashPassword("testpassword123");
    expect(hash).toBeTruthy();
    expect(hash).not.toBe("testpassword123");

    const isValid = await verifyPassword("testpassword123", hash);
    expect(isValid).toBe(true);
  });

  it("should reject wrong password", async () => {
    const hash = await hashPassword("testpassword123");
    const isValid = await verifyPassword("wrongpassword", hash);
    expect(isValid).toBe(false);
  });
});

describe("JWT (HMAC-SHA256)", () => {
  const secret = "test-secret-key-for-jwt";

  it("should create and verify a JWT", async () => {
    const token = await createJwt(42, secret);
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);

    const claims = await verifyJwt(token, secret);
    expect(claims.sub).toBe(42);
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("should reject a token with wrong secret", async () => {
    const token = await createJwt(42, secret);
    await expect(verifyJwt(token, "wrong-secret")).rejects.toThrow();
  });

  it("should reject an expired token", async () => {
    const token = await createJwt(42, secret, -1);
    await expect(verifyJwt(token, secret)).rejects.toThrow();
  });
});
