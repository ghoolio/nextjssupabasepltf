import { z } from 'zod'

export const authSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
  username: z.string().trim().min(2).max(40).optional(),
})

export const uploadMetadataSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  paymentType: z.enum(['free', 'paid']),
  priceCents: z.number().int().min(99).max(999999).optional(),
  currency: z.enum(['EUR', 'USD']).default('EUR'),
})

export const allowedVideoMimeTypes = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
])

export const maxVideoBytes = 200 * 1024 * 1024
