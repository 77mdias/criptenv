import { defineConfig } from "cypress"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const configDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  e2e: {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    setupNodeEvents(on) {
      on("task", {
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
