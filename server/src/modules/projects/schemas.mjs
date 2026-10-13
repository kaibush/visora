import { z } from 'zod'

const originSchema = z
  .string()
  .url()
  .max(255)
  .transform((s, ctx) => {
    const url = new URL(s)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '请填写完整网站来源，例如 https://example.com，不含路径',
      })
      return z.NEVER
    }
    return url.origin
  })

const userFieldPath = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/,
    '请填写字段路径，例如 id 或 profile.displayName'
  )
const optionalUserFieldPath = z
  .string()
  .trim()
  .max(80)
  .refine((value) => value === '' || userFieldPath.safeParse(value).success, {
    message: '请填写字段路径，例如 username 或 profile.email；留空表示不发送',
  })
export const projectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  origins: z
    .array(originSchema)
    .max(20)
    .transform((items) => [...new Set(items)]),
  enabled: z.boolean().default(true),
  userIdField: userFieldPath.default('id'),
  userNameField: optionalUserFieldPath.default('name'),
  userEmailField: optionalUserFieldPath.default('email'),
})
export const projectPatchSchema = z.object({
  name: projectSchema.shape.name.optional(),
  origins: projectSchema.shape.origins.optional(),
  enabled: z.boolean().optional(),
  userIdField: userFieldPath.optional(),
  userNameField: optionalUserFieldPath.optional(),
  userEmailField: optionalUserFieldPath.optional(),
})
