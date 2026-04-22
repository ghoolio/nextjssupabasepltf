import { createClient } from '@/lib/supabase-server'

export async function userCanAccessVideo(videoId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: video } = await supabase
    .from('videos')
    .select('id, user_id, file_path, visibility, is_active')
    .eq('id', videoId)
    .eq('is_active', true)
    .maybeSingle()

  if (!video) return { allowed: false as const, reason: 'Video nicht gefunden.' }

  if (video.visibility === 'public') {
    return { allowed: true as const, filePath: video.file_path }
  }

  if (!user) {
    return { allowed: false as const, reason: 'Login erforderlich.' }
  }

  if (user.id === video.user_id) {
    return { allowed: true as const, filePath: video.file_path }
  }

  if (video.visibility === 'private') {
    return { allowed: false as const, reason: 'Privates Video.' }
  }

  const { data: purchase } = await supabase
    .from('purchases')
    .select('id')
    .eq('buyer_user_id', user.id)
    .eq('video_id', videoId)
    .eq('status', 'paid')
    .maybeSingle()

  if (!purchase) {
    return { allowed: false as const, reason: 'Kauf erforderlich.' }
  }

  return { allowed: true as const, filePath: video.file_path }
}
