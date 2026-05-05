import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
})

export const signupSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Deve conter pelo menos 1 maiúscula")
    .regex(/[0-9]/, "Deve conter pelo menos 1 número")
    .regex(/[^A-Za-z0-9]/, "Deve conter pelo menos 1 símbolo"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"],
})

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(3, "Nome deve ter 3-50 caracteres")
    .max(50, "Nome deve ter 3-50 caracteres")
    .regex(/^[a-zA-Z0-9-]+$/, "Apenas letras, números e hífens"),
  description: z.string().max(255).optional(),
  vaultPassword: z.string().min(8, "Senha do vault deve ter pelo menos 8 caracteres"),
  confirmVaultPassword: z.string(),
}).refine((data) => data.vaultPassword === data.confirmVaultPassword, {
  message: "Senhas do vault não conferem",
  path: ["confirmVaultPassword"],
})

export const createSecretSchema = z.object({
  key: z
    .string()
    .min(3, "Chave deve ter 3-64 caracteres")
    .max(64, "Chave deve ter 3-64 caracteres")
    .regex(/^[A-Z][A-Z0-9_]*$/, "Chave deve ser UPPER_CASE"),
  value: z.string().min(1, "Valor obrigatório").max(10240, "Máximo 10KB"),
})

export const createEnvironmentSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter 2-20 caracteres")
    .max(20, "Nome deve ter 2-20 caracteres")
    .regex(/^[a-z][a-z0-9-]*$/, "Apenas lowercase, números e hífens"),
  display_name: z.string().max(50).optional(),
})

export const inviteMemberSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["developer", "viewer", "admin"]),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateSecretInput = z.infer<typeof createSecretSchema>
export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
