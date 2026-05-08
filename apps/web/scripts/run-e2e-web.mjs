import { spawn } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const envPath = existsSync(join(webRoot, ".env.test"))
  ? join(webRoot, ".env.test")
  : join(webRoot, ".env.test.example")

for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || line.startsWith("#") || !line.includes("=")) continue

  const [key, ...valueParts] = line.split("=")
  process.env[key.trim()] = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "")
}

const vinextBin = join(webRoot, "node_modules", ".bin", "vinext")
const child = spawn(vinextBin, ["dev", "--host", "localhost", "--port", "3000"], {
  cwd: webRoot,
  env: process.env,
  stdio: "inherit",
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  }
  process.exit(code ?? 0)
})
