// --- PBKDF2 Password Hashing ---

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const hash = await crypto.subtle.exportKey("raw", key);

  const saltHex = bufToHex(salt);
  const hashHex = bufToHex(new Uint8Array(hash));
  return `${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [iterStr, saltHex, hashHex] = stored.split(":");
  const iterations = parseInt(iterStr, 10);
  const salt = hexToBuf(saltHex);

  const key = await deriveKey(password, salt, iterations);
  const hash = await crypto.subtle.exportKey("raw", key);
  const computedHex = bufToHex(new Uint8Array(hash));

  return timingSafeEqual(computedHex, hashHex);
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256", length: HASH_LENGTH * 8 },
    true,
    ["sign"],
  );
}

// --- JWT (HMAC-SHA256) ---

export type JwtClaims = {
  sub: number;
  iat: number;
  exp: number;
};

export async function createJwt(
  userId: number,
  secret: string,
  expiresInDays = 7,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    sub: userId,
    iat: now,
    exp: now + expiresInDays * 86400,
  };

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = await sign(`${header}.${payload}`, secret);

  return `${header}.${payload}.${signature}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const [header, payload, signature] = parts;
  const expectedSig = await sign(`${header}.${payload}`, secret);

  if (!timingSafeEqual(signature, expectedSig)) {
    throw new Error("Invalid token signature");
  }

  const claims: JwtClaims = JSON.parse(base64urlDecode(payload));

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp < now) {
    throw new Error("Token has expired");
  }

  return claims;
}

// --- Helpers ---

async function sign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return base64url(sig);
}

function base64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const binStr = atob(padded);
  const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g);
  if (!matches) throw new Error("Invalid hex string");
  const bytes = matches.map((h) => parseInt(h, 16));
  return new Uint8Array(bytes);
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  // timingSafeEqual is a Cloudflare Workers extension on SubtleCrypto
  return (
    crypto.subtle as SubtleCrypto & { timingSafeEqual(a: BufferSource, b: BufferSource): boolean }
  ).timingSafeEqual(aBuf, bBuf);
}
