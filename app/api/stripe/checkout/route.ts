import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'

const PLATFORM_FEE_PERCENT = 10

function calculateApplicationFeeAmount(amountCents: number) {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100))
}

type VideoCheckoutRow = {
  id: string
  user_id: string
  title: string
  payment_type: 'free' | 'paid'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
}

type CreatorStripeRow = {
  id: string
  stripe_account_id: string | null
}

export async function POST(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const videoId = body?.videoId

  if (!videoId || typeof videoId !== 'string') {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const { data: rows, error: videoError } = await supabase
    .from('videos')
    .select('id, user_id, title, payment_type, price_cents, currency')
    .eq('id', videoId)
    .returns<VideoCheckoutRow[]>()

  if (videoError) {
    return NextResponse.json({ error: videoError.message }, { status: 500 })
  }

  const video = rows?.[0] ?? null

  if (!video) {
    return NextResponse.json({ error: 'Video nicht gefunden.' }, { status: 404 })
  }

  if (video.user_id === user.id) {
    return NextResponse.json(
      { error: 'Eigenes Video muss nicht gekauft werden.' },
      { status: 400 }
    )
  }

  if (video.payment_type !== 'paid') {
    return NextResponse.json({ error: 'Dieses Video ist kostenlos.' }, { status: 400 })
  }

  if (!video.price_cents || !video.currency) {
    return NextResponse.json({ error: 'Preisangaben fehlen.' }, { status: 400 })
  }

  const { data: creatorRows, error: creatorError } = await supabase
    .from('profiles')
    .select('id, stripe_account_id')
    .eq('id', video.user_id)
    .returns<CreatorStripeRow[]>()

  if (creatorError) {
    return NextResponse.json({ error: creatorError.message }, { status: 500 })
  }

  const creator = creatorRows?.[0] ?? null

  if (!creator?.stripe_account_id) {
    return NextResponse.json(
      { error: 'Creator hat kein verbundenes Stripe-Konto.' },
      { status: 400 }
    )
  }

  const applicationFeeAmount = calculateApplicationFeeAmount(video.price_cents)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${baseUrl}/video/${video.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/video/${video.id}?checkout=cancel`,
    line_items: [
      {
        price_data: {
          currency: video.currency.toLowerCase(),
          product_data: {
            name: video.title,
            description: 'Freischaltung für ein Video',
          },
          unit_amount: video.price_cents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: creator.stripe_account_id,
      },
      metadata: {
        videoId: video.id,
        buyerId: user.id,
        creatorId: creator.id,
        platformFeePercent: String(PLATFORM_FEE_PERCENT),
      },
    },
    metadata: {
      videoId: video.id,
      buyerId: user.id,
      creatorId: creator.id,
      platformFeePercent: String(PLATFORM_FEE_PERCENT),
    },
  })

  return NextResponse.json({ url: session.url })
}