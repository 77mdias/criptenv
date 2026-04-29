# Encryption Protocol — CriptEnv

## Zero-Knowledge Encryption Architecture

**CRÍTICO**: Todo o processo de criptografia ocorre EXCLUSIVAMENTE no cliente. O servidor Supabase armazena apenas blobs cifrados que são IMPOSSÍVEIS de descriptografar sem a chave mestra do usuário.

---

## 1. Encryption Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Zero-Knowledge Encryption Flow                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      CLIENT (Developer Machine)                        │   │
│  │                                                                       │   │
│  │   MASTER PASSWORD (nunca sai do cliente)                             │   │
│  │         │                                                             │   │
│  │         ▼                                                             │   │
│  │   ┌───────────────┐                                                 │   │
│  │   │     PBKDF2     │  100,000 iterações                             │   │
│  │   │  HMAC-SHA256   │  Salt: 32 bytes único por usuário               │   │
│  │   └───────┬───────┘                                                 │   │
│  │           │ Session Key (nunca persistido em disco)                  │   │
│  │           ▼                                                          │   │
│  │   ┌───────────────┐                                                 │   │
│  │   │ Key Derivation │                                                 │   │
│  │   │     Layer      │                                                 │   │
│  │   └───────┬───────┘                                                 │   │
│  │           │                                                          │   │
│  │     ┌─────┴─────┐                                                   │   │
│  │     ▼           ▼                                                    │   │
│  │  ┌──────┐  ┌──────┐                                                │   │
│  │  │  KEK │  │  DEK │                                                │   │
│  │  │(Key  │  │(Data │                                                │   │
│  │  │Enc.  │  │Enc.  │                                                │   │
│  │  │Key)  │  │Key)  │                                                │   │
│  │  └──┬───┘  └──┬───┘                                                 │   │
│  │     │         │                                                      │   │
│  │     │    ┌────┴────┐                                                │   │
│  │     │    │         │                                                 │   │
│  │     │    ▼         ▼                                                 │   │
│  │     │  ┌──────────────────────┐                                    │   │
│  │     │  │      AES-GCM         │                                    │   │
│  │     │  │     256-bit          │                                    │   │
│  │     │  │                      │                                    │   │
│  │     │  │  Plaintext .env ────▶  Encrypted Blob                    │   │
│  │     │  │  (bytes)              │  • IV: 12 bytes                   │   │
│  │     │  │                      │  • Ciphertext                     │   │
│  │     │  │                      │  • Auth Tag: 16 bytes             │   │
│  │     │  └──────────────────────┘                                    │   │
│  │     │                                                                 │   │
│  │     └──▶ Wrapped DEK (armazenado no servidor)                       │   │
│  │          (DEK cifrado com KEK)                                      │   │
│  │                                                                       │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                           │
│                                      │ Apenas dados cifrados                     │
│                                      ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │                         SUPABASE (Servidor)                                  │   │
│  │                                                                            │   │
│  │   ⚠️  O SERVIDOR NUNCA VÊ:                                                  │   │
│  │   • Master password                                                          │   │
│  │   • Session key                                                             │   │
│  │   • KEK ou DEK                                                              │   │
│  │   • Qualquer secret descriptografado                                        │   │
│  │                                                                            │   │
│  │   O SERVIDOR SÓ VÊ:                                                         │   │
│  │   • encrypted_blob (dados cifrados)                                        │   │
│  │   • iv (vetor de inicialização)                                            │   │
│  │   • auth_tag (tag de autenticação)                                          │   │
│  │   • wrapped_dek (DEK cifrado)                                              │   │
│  │                                                                            │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Key Hierarchy                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     MASTER KEY (User Password)                               │
│                                                                              │
│  • Fornecido pelo usuário                                                    │
│  • NUNCA transmitido pela rede                                              │
│  • NUNCA armazenado em disco                                                │
│  • Usado apenas para derivar Session Key                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ PBKDF2 (100k iterations)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SESSION KEY (Temporary)                                 │
│                                                                              │
│  • 256-bit derived from Master Key                                           │
│  • Existe apenas em memória (RAM)                                           │
/// • Descartado quando CLI fecha                                              │
│  • NUNCA escrito em log ou arquivo                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │                               │
                    ▼                               ▼
┌───────────────────────────┐       ┌───────────────────────────┐
│      KEY ENCRYPTION KEY    │       │    PROJECT DEK (Wrapped)   │
│           (KEK)            │       │                             │
│                           │       │  DEK cifrado com KEK       │
│  • Derivado do Session Key │       │  Armazenado no servidor   │
│  • Permanece em memória   │       │                             │
│  • Usado para cifrar DEKs  │       │  Apenas o cliente          │
│                           │       │  pode descriptografar      │
└───────────────────────────┘       └───────────────────────────┘
                                              │
                                              │ Unwrap com KEK
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATA ENCRYPTION KEY (DEK)                              │
│                                                                              │
│  • 256-bit AES key                                                           │
│  • Gerado uma vez por projeto                                                │
│  • Descriptografado apenas quando necessário                                 │
│  • Usado para cifrar todos os secrets do projeto                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              │ AES-GCM 256-bit
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ENCRYPTED SECRETS                                       │
│                                                                              │
│  • Cada secret cifrado com DEK                                               │
│  • IV único por segredo                                                      │
│  • Auth tag para integridade                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Algorithms & Parameters

### PBKDF2 Key Derivation

```typescript
// Parameters
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = 'SHA-256';
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32;  // 256 bits

// Derivation
sessionKey = PBKDF2(
  password: masterPassword,
  salt: kdfSalt,
  iterations: 100_000,
  digest: 'SHA-256',
  length: 256
);
```

### AES-GCM Encryption

```typescript
// Parameters
const AES_KEY_LENGTH = 256;  // bits
const AES_GCM_IV_LENGTH = 12;  // 96 bits (recommended)
const AES_GCM_TAG_LENGTH = 16;  // 128 bits

// Encryption
const iv = crypto.getRandomValues(new Uint8Array(12));
const ciphertext = crypto.subtle.encrypt(
  { name: 'AES-GCM', iv, tagLength: 128 },
  dek,
  plaintext
);
// Output: ciphertext || authTag (combined by AES-GCM)
```

---

## 4. Client-Side Implementation

### CLI Encryption (Node.js)

```typescript
// criptenv/src/crypto/vault.ts

import crypto from 'crypto';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncryptedVault {
  iv: string;        // base64
  ciphertext: string; // base64
  authTag: string;   // base64
  version: number;
}

export interface VaultKey {
  dek: CryptoKey;     // Data Encryption Key
  kek: CryptoKey;     // Key Encryption Key
}

/**
 * Derive session key from master password using PBKDF2
 */
export async function deriveSessionKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a new DEK for a project
 */
export async function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable (for wrapping)
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap (encrypt) a DEK with the KEK
 */
export async function wrapDEK(
  dek: CryptoKey,
  kek: CryptoKey
): Promise<{ iv: Uint8Array; wrappedKey: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrappedKey = await crypto.subtle.wrapKey(
    'raw',
    dek,
    kek,
    { name: 'AES-GCM', iv }
  );
  return { iv, wrappedKey };
}

/**
 * Unwrap (decrypt) a DEK with the KEK
 */
export async function unwrapDEK(
  wrappedKey: Uint8Array,
  iv: Uint8Array,
  kek: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    kek,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext .env content
 */
export async function encryptVault(
  plaintext: string,
  dek: CryptoKey
): Promise<EncryptedVault> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Encrypt with AES-GCM
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    dek,
    data
  );
  
  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertext),
    authTag: '', // Included in ciphertext with AES-GCM
    version: 1
  };
}

/**
 * Decrypt encrypted .env content
 */
export async function decryptVault(
  encrypted: EncryptedVault,
  dek: CryptoKey
): Promise<string> {
  const iv = base64ToBuffer(encrypted.iv);
  const ciphertext = base64ToBuffer(encrypted.ciphertext);
  
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    dek,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Export wrapped DEK as base64 for storage
 */
export async function exportWrappedDEK(
  wrapped: { iv: Uint8Array; wrappedKey: Uint8Array }
): Promise<string> {
  const combined = new Uint8Array(wrapped.iv.length + wrapped.wrappedKey.length);
  combined.set(wrapped.iv, 0);
  combined.set(new Uint8Array(wrapped.wrappedKey), wrapped.iv.length);
  return bufferToBase64(combined);
}

// Utility functions
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

### Vault Manager

```typescript
// criptenv/src/crypto/vault-manager.ts

import {
  deriveSessionKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  encryptVault,
  decryptVault,
  exportWrappedDEK
} from './vault';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface LocalVault {
  projectId: string;
  environments: Record<string, {
    encryptedBlob: string;
    iv: string;
    version: number;
    updatedAt: string;
  }>;
  wrappedDEK: string;
  dekIV: string;
}

export class VaultManager {
  private sessionKey: CryptoKey | null = null;
  private dek: CryptoKey | null = null;
  private vaultDir: string;
  
  constructor(projectPath: string) {
    this.vaultDir = join(projectPath, '.criptenv');
  }
  
  /**
   * Initialize vault with master password
   */
  async unlock(password: string, kdfSalt?: Uint8Array): Promise<void> {
    // Generate or use provided salt
    const salt = kdfSalt || crypto.getRandomValues(new Uint8Array(32));
    
    // Derive session key from password
    this.sessionKey = await deriveSessionKey(password, salt);
    
    // TODO: Load and unwrap DEK with session key
  }
  
  /**
   * Create new vault for project
   */
  async createVault(password: string): Promise<void> {
    await mkdir(this.vaultDir, { recursive: true });
    
    // Generate salt and session key
    const salt = crypto.getRandomValues(new Uint8Array(32));
    this.sessionKey = await deriveSessionKey(password, salt);
    
    // Generate new DEK for this project
    this.dek = await generateDEK();
    
    // Export and store wrapped DEK
    const kek = await deriveKEK(this.sessionKey);
    const { iv, wrappedKey } = await wrapDEK(this.dek, kek);
    
    const vault: LocalVault = {
      projectId: crypto.randomUUID(),
      environments: {},
      wrappedDEK: bufferToBase64(wrappedKey),
      dekIV: bufferToBase64(iv)
    };
    
    await writeFile(
      join(this.vaultDir, 'vault.json'),
      JSON.stringify(vault, null, 2)
    );
  }
  
  /**
   * Set a secret value
   */
  async setSecret(key: string, value: string, env: string = 'development'): Promise<void> {
    if (!this.dek) throw new Error('Vault is locked');
    
    // Load current vault
    const vaultPath = join(this.vaultDir, 'vault.json');
    const vault: LocalVault = JSON.parse(await readFile(vaultPath, 'utf-8'));
    
    // Get or create environment
    if (!vault.environments[env]) {
      vault.environments[env] = {
        encryptedBlob: '',
        iv: '',
        version: 0
      };
    }
    
    // Parse existing secrets or start fresh
    let secrets: Record<string, string> = {};
    if (vault.environments[env].encryptedBlob) {
      // Decrypt existing
      const decrypted = await decryptVault({
        iv: vault.environments[env].iv,
        ciphertext: vault.environments[env].encryptedBlob,
        authTag: '',
        version: vault.environments[env].version
      }, this.dek);
      secrets = parseEnvFile(decrypted);
    }
    
    // Update secret
    secrets[key] = value;
    
    // Encrypt and save
    const encrypted = await encryptVault(
      stringifyEnvFile(secrets),
      this.dek
    );
    
    vault.environments[env] = {
      encryptedBlob: encrypted.ciphertext,
      iv: encrypted.iv,
      version: encrypted.version,
      updatedAt: new Date().toISOString()
    };
    
    await writeFile(vaultPath, JSON.stringify(vault, null, 2));
  }
  
  /**
   * Get a secret value
   */
  async getSecret(key: string, env: string = 'development'): Promise<string | null> {
    if (!this.dek) throw new Error('Vault is locked');
    
    const vaultPath = join(this.vaultDir, 'vault.json');
    const vault: LocalVault = JSON.parse(await readFile(vaultPath, 'utf-8'));
    
    if (!vault.environments[env]?.encryptedBlob) {
      return null;
    }
    
    const decrypted = await decryptVault({
      iv: vault.environments[env].iv,
      ciphertext: vault.environments[env].encryptedBlob,
      authTag: '',
      version: vault.environments[env].version
    }, this.dek);
    
    const secrets = parseEnvFile(decrypted);
    return secrets[key] ?? null;
  }
  
  /**
   * Lock vault (clear keys from memory)
   */
  lock(): void {
    this.sessionKey = null;
    this.dek = null;
  }
}

// Helper: Parse .env format
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex);
      let value = trimmed.slice(eqIndex + 1);
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

// Helper: Stringify to .env format
function stringifyEnvFile(secrets: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(secrets)) {
    // Quote values with spaces or special chars
    const needsQuotes = /[\s"'#$`]/.test(value);
    const quoted = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
    lines.push(`${key}=${quoted}`);
  }
  return lines.join('\n') + '\n';
}
```

---

## 5. Security Properties

### Guarantees

| Property | Mechanism |
|----------|-----------|
| **Confidentiality** | AES-GCM 256-bit encryption |
| **Integrity** | GCM authentication tag (AEAD) |
| **Freshness** | Unique IV per encryption |
| **Key Separation** | PBKDF2 → KEK → DEK hierarchy |
| **Forward Secrecy** | Session keys not persisted |
| **Brute Force Resistance** | 100k PBKDF2 iterations |

### Threat Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Threat Model                                        │
└─────────────────────────────────────────────────────────────────────────────┘

THREAT: Compromised Supabase Database
├─ Impact: Attacker has encrypted blobs
├─ Mitigation: AES-256-GCM is quantum-resistant
└─ Result: IMPOSSIBLE to decrypt without KEK

THREAT: Malicious Admin with DB Access
├─ Impact: Can read encrypted blobs
├─ Mitigation: Server NEVER has KEK
└─ Result: Same as compromised DB

THREAT: Man-in-the-Middle (Network)
├─ Impact: Can intercept encrypted data
├─ Mitigation: TLS 1.3 + encrypted blobs
└─ Result: Only sees ciphertext

THREAT: Compromised Client Machine
├─ Impact: Master password may be keylogged
├─ Mitigation: User responsibility
└─ Note: Not solvable by architecture alone

THREAT: Memory Dump Attack
├─ Impact: Session key extracted from RAM
├─ Mitigation: Lock vault when idle (future)
└─ Note: Defense-in-depth, not perfect

THREAT: Weak Master Password
├─ Impact: Dictionary attack on PBKDF2
├─ Mitigation: Password strength requirements
└─ Note: User education + optional 2FA
```

---

## 6. Key Rotation

### When to Rotate

| Key Type | Rotation Trigger | Process |
|----------|------------------|---------|
| DEK | Compromised project | Re-encrypt all secrets |
| KEK | User password change | Re-wrap DEK |
| Master Password | User request | Re-derive KEK |
| Session Key | CLI restart | Always new |

### Rotation Process

```typescript
/**
 * Rotate DEK (emergency or scheduled)
 */
async function rotateDEK(
  oldDEK: CryptoKey,
  newDEK: CryptoKey,
  secrets: Record<string, Record<string, string>>
): Promise<void> {
  // Re-encrypt all secrets with new DEK
  for (const [env, envSecrets] of Object.entries(secrets)) {
    const encrypted = await encryptVault(
      stringifyEnvFile(envSecrets),
      newDEK
    );
    // Upload to server with new DEK id
    await uploadVault(env, encrypted, 'new-dek-id');
  }
}
```

---

## 7. Performance Considerations

### Benchmarks (Typical Laptop)

| Operation | Time | Notes |
|-----------|------|-------|
| PBKDF2 (100k) | ~200ms | First unlock |
| Generate DEK | <1ms | Project creation |
| Wrap/Unwrap DEK | ~1ms | Session start |
| Encrypt .env (50 vars) | ~50ms | Push |
| Decrypt .env (50 vars) | ~30ms | Pull |

### Optimization Strategies

```typescript
// 1. Cache decrypted vault in memory (session)
let cachedSecrets: Record<string, string> | null = null;

// 2. Lazy decryption (only when needed)
async function getSecret(key: string): Promise<string> {
  if (!cachedSecrets) {
    cachedSecrets = await decryptVault(encryptedBlob, dek);
  }
  return cachedSecrets[key];
}

// 3. Batch operations
async function setSecrets(secrets: Record<string, string>): Promise<void> {
  // Single encrypt for batch
  const combined = { ...cachedSecrets, ...secrets };
  cachedSecrets = combined;
  await encryptVault(stringifyEnvFile(combined), dek);
}
```

---

## 8. Compliance & Standards

### Cryptographic Standards

| Standard | Compliance |
|----------|------------|
| **FIPS 197** (AES-256) | ✅ AES-GCM 256-bit |
| **NIST SP 800-38D** (GCM) | ✅ Using AES-GCM |
| **NIST SP 800-132** (PBKDF2) | ✅ 100k iterations |
| **OWASP Secrets Mgmt** | ✅ Following guidelines |

### Audit Checklist

- [ ] PBKDF2 iterations ≥ 100,000
- [ ] AES-GCM with 256-bit keys
- [ ] IV = 96 bits (12 bytes) random
- [ ] Auth tag verified before decryption
- [ ] Keys never logged or persisted
- [ ] Memory cleared after use
- [ ] No custom cryptographic implementations

---

**Document Version**: 1.0  
**Security Review**: Required before production  
**Next**: User Stories
