'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { authSchema } from '@/lib/validation'

type DeleteVideoRow = {
  id: string
  user_id: string
  file_path: string
  thumbnail_path: string | null
}

type VideoPurchaseTargetRow = {
  id: string
  user_id: string
  payment_type: 'free' | 'paid'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
}

type PurchaseInsertRow = {
  video_id: string
  buyer_id: string
  amount_cents: number
  currency: 'EUR' | 'USD'
  payment_status: 'paid'
  provider: string
  provider_payment_id: string
}

type MembershipTierRow = {
  id: string
  creator_id: string
  price_cents: number
  currency: 'EUR' | 'USD'
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const parsed = authSchema.pick({ email: true, password: true }).safeParse({
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
  })

  if (!parsed.success) {
    return { error: 'Ungültige Eingaben.' }
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: error.message }
  }

  redirect('/my-videos')
}

export async function register(formData: FormData) {
  const supabase = await createClient()

  const email = String(formData.get('email') || '')
  const password = String(formData.get('password') || '')
  const username = String(formData.get('username') || '')

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/login')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function deleteVideo(videoId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: rows } = await supabase
    .from('videos')
    .select('id, user_id, file_path, thumbnail_path')
    .eq('id', videoId)
    .returns<DeleteVideoRow[]>()

  const video = rows?.[0] ?? null

  if (!video || video.user_id !== user.id) {
    return { error: 'Nicht erlaubt.' }
  }

  const removePaths = [video.file_path]
  if (video.thumbnail_path) removePaths.push(video.thumbnail_path)

  await supabase.storage.from('videos').remove(removePaths)

  const { error } = await supabase
    .from('videos')
    .delete()
    .eq('id', videoId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  redirect('/my-videos')
}

export async function mockPurchaseVideo(videoId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: rows } = await supabase
    .from('videos')
    .select('id, user_id, payment_type, price_cents, currency')
    .eq('id', videoId)
    .returns<VideoPurchaseTargetRow[]>()

  const video = rows?.[0] ?? null

  if (!video) {
    return { error: 'Video nicht gefunden.' }
  }

  if (video.user_id === user.id) {
    return { error: 'Eigenes Video muss nicht gekauft werden.' }
  }

  if (video.payment_type !== 'paid') {
    return { error: 'Dieses Video ist kostenlos.' }
  }

  if (!video.price_cents || !video.currency) {
    return { error: 'Preisangaben fehlen.' }
  }

  const payload: PurchaseInsertRow = {
    video_id: video.id,
    buyer_id: user.id,
    amount_cents: video.price_cents,
    currency: video.currency,
    payment_status: 'paid',
    provider: 'mock',
    provider_payment_id: `mock_${video.id}_${user.id}`,
  }

  const { error } = await supabase
    .from('video_purchases')
    .upsert([payload] as any, { onConflict: 'video_id,buyer_id' })

  if (error) {
    return { error: error.message }
  }

  redirect(`/video/${video.id}`)
}

export async function mockJoinMembership(tierId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: tierRows } = await supabase
    .from('membership_tiers')
    .select('id, creator_id, price_cents, currency')
    .eq('id', tierId)
    .returns<MembershipTierRow[]>()

  const tier = tierRows?.[0] ?? null

  if (!tier) {
    return { error: 'Tier nicht gefunden.' }
  }

  if (tier.creator_id === user.id) {
    return { error: 'Du kannst nicht Mitglied deines eigenen Kanals werden.' }
  }

  const membershipsTable = supabase.from('creator_memberships') as any

  const { error } = await membershipsTable.upsert(
    [
      {
        creator_id: tier.creator_id,
        member_id: user.id,
        tier_id: tier.id,
        status: 'active',
        provider: 'mock',
        provider_subscription_id: `mock_member_${tier.id}_${user.id}`,
      },
    ],
    { onConflict: 'creator_id,member_id' }
  )

  if (error) {
    return { error: error.message }
  }

  redirect(`/channel/${tier.creator_id}?membership=success`)
}