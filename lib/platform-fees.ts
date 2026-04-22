export const PLATFORM_FEE_PERCENT = 10

export function calculateApplicationFeeAmount(amountCents: number) {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100))
}