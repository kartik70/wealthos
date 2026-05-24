import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/db/supabase";
import type { AIProvider } from "@/lib/ai/provider";
import type { Database } from "@/types/db";

const ENCRYPTION_VERSION = "v1";
const KEY_DERIVATION_SECRET = "wealthos-byok";
const IV_LENGTH = 12;

type UserApiKeyInsert = Database["public"]["Tables"]["user_api_keys"]["Insert"];

export interface UserApiKeyStatus {
  anthropicLast4: string | null;
  geminiLast4: string | null;
  updatedAt: string | null;
}

export interface UserApiKeyInput {
  anthropicKey?: string;
  geminiKey?: string;
}

export const NO_API_KEY_CONFIGURED_MESSAGE =
  "No API key configured. Please add your API key in Settings.";

export function hasEnvironmentApiKey(provider: AIProvider): boolean {
  const value = provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
  return value !== undefined && value.trim() !== "";
}

export async function getEffectiveApiKey(
  userId: string,
  provider: AIProvider,
): Promise<string | undefined> {
  const storedKey = await getUserApiKeyForProvider(userId, provider);
  if (storedKey !== null) {
    return storedKey;
  }

  const envKey = provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
  return envKey === undefined || envKey.trim() === "" ? undefined : envKey;
}

export async function getUserApiKeyStatus(userId: string): Promise<UserApiKeyStatus> {
  const row = await getUserApiKeyRow(userId);

  return {
    anthropicLast4: getEncryptedKeyLast4(row?.anthropic_key ?? null),
    geminiLast4: getEncryptedKeyLast4(row?.gemini_key ?? null),
    updatedAt: row?.updated_at ?? null,
  };
}

export async function saveUserApiKeys(
  userId: string,
  input: UserApiKeyInput,
): Promise<UserApiKeyStatus> {
  const existing = await getUserApiKeyRow(userId);
  const anthropicKey = input.anthropicKey?.trim();
  const geminiKey = input.geminiKey?.trim();

  const row: UserApiKeyInsert = {
    user_id: userId,
    anthropic_key:
      anthropicKey === undefined || anthropicKey === ""
        ? existing?.anthropic_key ?? null
        : encryptApiKey(anthropicKey),
    gemini_key:
      geminiKey === undefined || geminiKey === ""
        ? existing?.gemini_key ?? null
        : encryptApiKey(geminiKey),
    updated_at: new Date().toISOString(),
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("user_api_keys").upsert(row, { onConflict: "user_id" });

  if (error !== null) {
    throw new Error(`Failed to save API keys: ${error.message}`);
  }

  return getUserApiKeyStatus(userId);
}

export async function getUserApiKeyForProvider(
  userId: string,
  provider: AIProvider,
): Promise<string | null> {
  const row = await getUserApiKeyRow(userId);
  const encryptedKey = provider === "anthropic" ? row?.anthropic_key : row?.gemini_key;

  if (encryptedKey === null || encryptedKey === undefined || encryptedKey === "") {
    return null;
  }

  return decryptApiKey(encryptedKey);
}

async function getUserApiKeyRow(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_api_keys")
    .select("user_id,anthropic_key,gemini_key,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`Failed to load API keys: ${error.message}`);
  }

  return data;
}

function getEncryptedKeyLast4(encryptedKey: string | null): string | null {
  if (encryptedKey === null || encryptedKey === "") {
    return null;
  }

  const key = decryptApiKey(encryptedKey);
  return key.slice(-4);
}

function getEncryptionKey(): Buffer {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey === undefined || serviceRoleKey.trim() === "") {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return scryptSync(KEY_DERIVATION_SECRET, serviceRoleKey, 32);
}

function encryptApiKey(apiKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function decryptApiKey(encryptedKey: string): string {
  const [version, ivText, authTagText, ciphertextText] = encryptedKey.split(":");

  if (
    version !== ENCRYPTION_VERSION ||
    ivText === undefined ||
    authTagText === undefined ||
    ciphertextText === undefined
  ) {
    throw new Error("Stored API key format is invalid");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
