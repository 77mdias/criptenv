import {
  createEnvironmentSchema,
  createProjectSchema,
  createSecretSchema,
  loginSchema,
  signupSchema,
} from "../schemas"

describe("validators", () => {
  it("accepts valid login data and rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "secret" }).success).toBe(true)
    expect(loginSchema.safeParse({ email: "bad", password: "secret" }).success).toBe(false)
  })

  it("requires strong signup passwords and matching confirmation", () => {
    expect(
      signupSchema.safeParse({
        name: "Jean",
        email: "jean@example.com",
        password: "Passw0rd!",
        confirmPassword: "Passw0rd!",
      }).success
    ).toBe(true)

    expect(
      signupSchema.safeParse({
        name: "Jean",
        email: "jean@example.com",
        password: "password",
        confirmPassword: "different",
      }).success
    ).toBe(false)
  })

  it("validates project vault password confirmation", () => {
    expect(
      createProjectSchema.safeParse({
        name: "my-api",
        description: "API",
        vaultPassword: "VaultPassw0rd!",
        confirmVaultPassword: "VaultPassw0rd!",
      }).success
    ).toBe(true)

    expect(
      createProjectSchema.safeParse({
        name: "my api",
        vaultPassword: "VaultPassw0rd!",
        confirmVaultPassword: "OtherPassw0rd!",
      }).success
    ).toBe(false)
  })

  it("requires UPPER_CASE secret keys and lowercase environment names", () => {
    expect(createSecretSchema.safeParse({ key: "DATABASE_URL", value: "postgres" }).success).toBe(true)
    expect(createSecretSchema.safeParse({ key: "database_url", value: "postgres" }).success).toBe(false)

    expect(createEnvironmentSchema.safeParse({ name: "preview-1", display_name: "Preview" }).success).toBe(true)
    expect(createEnvironmentSchema.safeParse({ name: "Preview", display_name: "Preview" }).success).toBe(false)
  })
})
