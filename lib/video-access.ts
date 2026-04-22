import type { Database } from '@/types/database'

export type VideoRow = Database['public']['Tables']['videos']['Row']
export type PurchaseRow = Database['public']['Tables']['video_purchases']['Row']

export function canAccessVideo(args: {
  userId?: string | null
  video: VideoRow
  purchase?: PurchaseRow | null
}) {
  const { userId, video, purchase } = args

  if (video.payment_type === 'free') return true
  if (!userId) return false
  if (video.user_id === userId) return true
  return purchase?.payment_status === 'paid'
}
