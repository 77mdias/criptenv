import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const nextJest = require(["next", "jest"].join("/"))
const createJestConfig = nextJest({ dir: "./" })

const customJestConfig = {
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/cypress/"],
}

export default createJestConfig(customJestConfig)
