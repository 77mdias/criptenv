import { defineConfig } from "cypress"
import { execFileSync } from "node:child_process"
import { createHmac } from "node:crypto"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const configDir = dirname(fileURLToPath(import.meta.url))

/** The current 6-digit code for a base32 TOTP secret (RFC 6238: SHA-1, 30 s), as an authenticator app shows it. */
function totp(secret: string): string {
  const bits = [...secret.replace(/=+$/, "").toUpperCase()]
    .map((char) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char).toString(2).padStart(5, "0"))
    .join("")
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const hmac = createHmac("sha1", key).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

export default defineConfig({
  e2e: {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    setupNodeEvents(on) {
      on("task", {
        log(message) {
          console.log(message)
          return null
        },
        totp,
        resetDb() {
          const apiRoot = resolve(configDir, "../api")
          const venvPython = join(apiRoot, ".venv", "bin", "python")
          execFileSync(existsSync(venvPython) ? venvPython : "python", ["scripts/reset_e2e_db.py"], {
            cwd: apiRoot,
            stdio: "inherit",
          })
          return null
        },
      })
    },
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    viewportHeight: 900,
    viewportWidth: 1280,
  },
})
