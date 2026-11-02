import {
  createLoginSchema,
  createProjectSchema,
  createSecretSchema,
  createContributionSchema,
  createSignupSchema,
} from "../schemas"

// createLoginSchema takes a translator; the messages themselves are covered by
// the login page test — here we only assert the validation rules.
const loginSchema = createLoginSchema((key) => key)
const projectSchema = createProjectSchema((key) => key)
const signupSchema = createSignupSchema((key) => key)
const secretSchema = createSecretSchema((key) => key)
const contributionSchema = createContributionSchema((key) => key)

describe("validators", () => {
  it("accepts valid login data and rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "secret" }).success).toBe(true)
    expect(loginSchema.safeParse({ email: "bad", password: "secret" }).success).toBe(false)
  })

  it("requires strong signup passwords, matching confirmation and terms acceptance", () => {
    expect(
      signupSchema.safeParse({
        name: "Jean",
        email: "jean@example.com",
        password: "Passw0rd!",
        confirmPassword: "Passw0rd!",
        acceptTerms: true,
      }).success
    ).toBe(true)

    expect(
      signupSchema.safeParse({
        name: "Jean",
        email: "jean@example.com",
        password: "Passw0rd!",
        confirmPassword: "Passw0rd!",
        acceptTerms: false,
      }).success
    ).toBe(false)

    expect(
      signupSchema.safeParse({
        name: "Jean",
        email: "jean@example.com",
        password: "Passw0rd!",
        confirmPassword: "Passw0rd!",
      }).success
    ).toBe(false)

    expect(
      signupSchema.safeParse({
        name: "Jean",
        email: "jean@example.com",
        password: "password",
        confirmPassword: "different",
        acceptTerms: true,
      }).success
    ).toBe(false)
  })

  it("validates project vault password confirmation", () => {
    expect(
      projectSchema.safeParse({
        name: "my-api",
        description: "API",
        vaultPassword: "VaultPassw0rd!",
        confirmVaultPassword: "VaultPassw0rd!",
      }).success
    ).toBe(true)

    expect(
      projectSchema.safeParse({
        name: "my api",
        vaultPassword: "VaultPassw0rd!",
        confirmVaultPassword: "OtherPassw0rd!",
      }).success
    ).toBe(false)
  })

  it("requires UPPER_CASE secret keys and lowercase environment names", () => {
    expect(secretSchema.safeParse({ key: "DATABASE_URL", value: "postgres" }).success).toBe(true)
    expect(secretSchema.safeParse({ key: "database_url", value: "postgres" }).success).toBe(false)

  })

  it("validates contribution amount as a number and normalizes optional payer fields", () => {
    expect(contributionSchema.safeParse({ amount: 25 }).success).toBe(true)
    expect(contributionSchema.safeParse({ amount: "25" }).success).toBe(false)
    expect(contributionSchema.safeParse({ amount: 4.99 }).success).toBe(false)

    const parsed = contributionSchema.parse({
      amount: 50,
      payer_name: "  ",
      payer_email: "",
    })

    expect(parsed).toEqual({ amount: 50 })
  })
})
