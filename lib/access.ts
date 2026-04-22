import { createClient } from '@/lib/supabase-server'

type AccessVideoRow = {
  id: string
  user_id: string
  file_path: string
  visibility_type: 'public' | 'paid' | 'members'
}

type VideoPurchaseRow = {
  video_id: string
  buyer_id: string
  payment_status: 'paid' | 'refunded' | 'failed'
}

type CreatorMembershipRow = {
  creator_id: string
  member_id: string
  status: 'active' | 'canceled' | 'expired'
  current_period_end: string | null
}

export async function canAccessVideo({
  videoId,
  userId,
}: {
  videoId: string
  userId?: string | null
}) {
  const supabase = await createClient()

  const { data: videoRows, error: videoError } = await supabase
    .from('videos')
    .select('id, user_id, file_path, visibility_type')
    .eq('id', videoId)
    .returns<AccessVideoRow[]>()

  if (videoError) {
    return {
      allowed: false as const,
      reason: videoError.message,
    }
  }

  const video = videoRows?.[0] ?? null

  if (!video) {
    return {
      allowed: false as const,
      reason: 'Video nicht gefunden.',
    }
  }

  if (video.visibility_type === 'public') {
    return {
      allowed: true as const,
      filePath: video.file_path,
    }
  }

  if (!userId) {
    return {
      allowed: false as const,
      reason: 'Nicht eingeloggt.',
    }
  }

  if (video.user_id === userId) {
    return {
      allowed: true as const,
      filePath: video.file_path,
    }
  }

  if (video.visibility_type === 'paid') {
    const { data: purchaseRows, error: purchaseError } = await supabase
      .from('video_purchases')
      .select('video_id, buyer_id, payment_status')
      .eq('video_id', videoId)
      .eq('buyer_id', userId)
      .returns<VideoPurchaseRow[]>()

    if (purchaseError) {
      return {
        allowed: false as const,
        reason: purchaseError.message,
      }
    }

    const purchase =
      purchaseRows?.find((row) => row.payment_status === 'paid') ?? null

    if (purchase) {
      return {
        allowed: true as const,
        filePath: video.file_path,
      }
    }

    return {
      allowed: false as const,
      reason: 'Video wurde nicht gekauft.',
    }
  }

  if (video.visibility_type === 'members') {
    const { data: membershipRows, error: membershipError } = await supabase
      .from('creator_memberships')
      .select('creator_id, member_id, status, current_period_end')
      .eq('creator_id', video.user_id)
      .eq('member_id', userId)
      .returns<CreatorMembershipRow[]>()

    if (membershipError) {
      return {
        allowed: false as const,
        reason: membershipError.message,
      }
    }

    const now = Date.now()

    const activeMembership =
      membershipRows?.find((row) => {
        if (row.status !== 'active') return false
        if (!row.current_period_end) return true
        return new Date(row.current_period_end).getTime() > now
      }) ?? null

    if (activeMembership) {
      return {
        allowed: true as const,
        filePath: video.file_path,
      }
    }

    return {
      allowed: false as const,
      reason: 'Aktive Mitgliedschaft erforderlich.',
    }
  }

  return {
    allowed: false as const,
    reason: 'Kein Zugriff.',
  }
}