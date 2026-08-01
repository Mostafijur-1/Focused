import { createHmac, randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const periodSeconds = 30;
const digits = 6;

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function verifyTotp(
  secret: string,
  code: string,
  now: Date,
  lastAcceptedCounter: bigint,
): bigint | null {
  if (!/^\d{6}$/u.test(code)) return null;
  const current = BigInt(Math.floor(now.getTime() / 1000 / periodSeconds));
  for (const offset of [-1n, 0n, 1n]) {
    const counter = current + offset;
    if (counter <= lastAcceptedCounter) continue;
    if (hotp(secret, counter) === code) return counter;
  }
  return null;
}

export function generateRecoveryCodes(count = 8): readonly string[] {
  return Array.from({ length: count }, () => {
    const value = randomBytes(8).toString("hex").toUpperCase();
    return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12)}`;
  });
}

function hotp(secret: string, counter: bigint): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(buffer)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

function encodeBase32(value: Uint8Array): string {
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    encoded += alphabet[Number.parseInt(chunk, 2)];
  }
  return encoded;
}

function decodeBase32(value: string): Buffer {
  const normalized = value.replaceAll("=", "").toUpperCase();
  let bits = "";
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid TOTP secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}
