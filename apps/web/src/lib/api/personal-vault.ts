import { ApiError, request } from "./client"
import type { EncryptedField, EncryptedItem, PersonalVaultConfigInput } from "@/lib/personal-vault/crypto"

// Web dashboard only: these routes accept the session cookie and refuse any
// Authorization header (CLI, API keys, CI tokens).
const BASE = "/api/v1/personal-vault"

export type PersonalVaultConfig = PersonalVaultConfigInput & {
  version: number
  created_at: string
  updated_at: string
}

export interface PersonalVaultItem {
  id: string
  protected: boolean
  summary: EncryptedField
  body: EncryptedField
  version: number
  created_at: string
  updated_at: string
}

export async function getPersonalVaultConfig(): Promise<PersonalVaultConfig | null> {
  try {
    return await request<PersonalVaultConfig>("GET", `${BASE}/config`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function createPersonalVaultConfig(input: PersonalVaultConfigInput): Promise<PersonalVaultConfig> {
  return request("POST", `${BASE}/config`, input)
}

export function updatePersonalVaultConfig(
  input: PersonalVaultConfigInput,
  expectedVersion: number,
): Promise<PersonalVaultConfig> {
  return request("PUT", `${BASE}/config`, { ...input, expected_version: expectedVersion })
}

export function listPersonalVaultItems(): Promise<PersonalVaultItem[]> {
  return request("GET", `${BASE}/items`)
}

export function createPersonalVaultItem(input: EncryptedItem): Promise<PersonalVaultItem> {
  return request("POST", `${BASE}/items`, input)
}

export function updatePersonalVaultItem(
  id: string,
  input: EncryptedItem,
  expectedVersion: number,
): Promise<PersonalVaultItem> {
  // The id travels in the URL only: the body never tries to move an item.
  const { protected: isProtected, summary, body } = input
  return request("PUT", `${BASE}/items/${encodeURIComponent(id)}`, {
    protected: isProtected,
    summary,
    body,
    expected_version: expectedVersion,
  })
}

export function deletePersonalVaultItem(id: string): Promise<void> {
  return request("DELETE", `${BASE}/items/${encodeURIComponent(id)}`)
}

/** The plan limit was reached (items or folders): the server answers 402, never 409. */
export function isPlanLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 402
}

// ─── Folders: the name is an envelope; which items are in a folder lives in each item's summary.

export interface PersonalVaultFolder {
  id: string
  name: EncryptedField
  version: number
  created_at: string
  updated_at: string
}

export function listPersonalVaultFolders(): Promise<PersonalVaultFolder[]> {
  return request("GET", `${BASE}/folders`)
}

export function createPersonalVaultFolder(input: { id: string; name: EncryptedField }): Promise<PersonalVaultFolder> {
  return request("POST", `${BASE}/folders`, input)
}

export function updatePersonalVaultFolder(
  id: string,
  name: EncryptedField,
  expectedVersion: number,
): Promise<PersonalVaultFolder> {
  return request("PUT", `${BASE}/folders/${encodeURIComponent(id)}`, { name, expected_version: expectedVersion })
}

export function deletePersonalVaultFolder(id: string): Promise<void> {
  return request("DELETE", `${BASE}/folders/${encodeURIComponent(id)}`)
}
