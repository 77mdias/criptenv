import { z } from "zod"

/**
 * Zod messages are baked in at schema-construction time, so any schema whose
 * messages are user-visible cannot live at module scope once the app is
 * translated. Every schema is therefore a factory that receives a translator
 * (see `createLoginSchema`).
 */

/** Translator shape shared by next-intl's `useTranslations`/`getTranslations`. */
export type ValidatorTranslator = (key: string) => string

export const createLoginSchema = (t: ValidatorTranslator) =>
  z.object({
    email: z.string().email(t("errors.invalidEmail")),
    password: z.string().min(1, t("errors.passwordRequired")),
  })

export type LoginInput = z.infer<ReturnType<typeof createLoginSchema>>

export const createSignupSchema = (t: ValidatorTranslator) =>
  z
    .object({
      name: z.string().min(2, t("errors.nameLength")),
      email: z.string().email(t("errors.invalidEmail")),
      password: z
        .string()
        .min(8, t("errors.passwordLength"))
        .regex(/[A-Z]/, t("errors.passwordUppercase"))
        .regex(/[0-9]/, t("errors.passwordNumber"))
        .regex(/[^A-Za-z0-9]/, t("errors.passwordSymbol")),
      confirmPassword: z.string(),
      acceptTerms: z.boolean().refine((value) => value === true, {
        message: t("errors.acceptTerms"),
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("errors.passwordMismatch"),
      path: ["confirmPassword"],
    })

export const createProjectSchema = (t: ValidatorTranslator) =>
  z
    .object({
      name: z
        .string()
        .min(3, t("createDialog.errors.nameLength"))
        .max(50, t("createDialog.errors.nameLength"))
        .regex(/^[a-zA-Z0-9-]+$/, t("createDialog.errors.nameCharset")),
      description: z.string().max(255).optional(),
      vaultPassword: z
        .string()
        .min(8, t("createDialog.errors.vaultPasswordLength")),
      confirmVaultPassword: z.string(),
    })
    .refine((data) => data.vaultPassword === data.confirmVaultPassword, {
      message: t("createDialog.errors.vaultPasswordMismatch"),
      path: ["confirmVaultPassword"],
    })

export const createSecretSchema = (t: ValidatorTranslator) =>
  z.object({
    key: z
      .string()
      .min(3, t("errors.keyLength"))
      .max(64, t("errors.keyLength"))
      .regex(/^[A-Z][A-Z0-9_]*$/, t("errors.keyFormat")),
    value: z.string().min(1, t("errors.valueRequired")).max(10240, t("errors.valueTooLarge")),
  })

export const createInviteMemberSchema = (t: ValidatorTranslator) =>
  z.object({
    email: z.string().email(t("errors.invalidEmail")),
    role: z.enum(["developer", "viewer", "admin"]),
  })

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

export const createContributionSchema = (t: ValidatorTranslator) =>
  z.object({
    amount: z
      .number({ error: t("errors.amountInvalid") })
      .min(5, { error: t("errors.amountMin") })
      .max(100000, { error: t("errors.amountMax") }),
    payer_name: z.preprocess(
      emptyStringToUndefined,
      z.string().max(255, { error: t("errors.nameTooLong") }).optional()
    ),
    payer_email: z.preprocess(
      emptyStringToUndefined,
      z.string().email(t("errors.invalidEmail")).max(255, { error: t("errors.emailTooLong") }).optional()
    ),
  })

export type SignupInput = z.infer<ReturnType<typeof createSignupSchema>>
export type CreateProjectInput = z.infer<ReturnType<typeof createProjectSchema>>
export type CreateSecretInput = z.infer<ReturnType<typeof createSecretSchema>>
export type InviteMemberInput = z.infer<ReturnType<typeof createInviteMemberSchema>>
export type ContributionInput = z.infer<ReturnType<typeof createContributionSchema>>
