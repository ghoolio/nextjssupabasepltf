import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase-server'

const PLATFORM_FEE_PERCENT = 10

type TierRow = {
  id: string
  creator_id: string
  name: string
  description: string | null
  price_cents: number
  currency: 'EUR' | 'USD'
  stripe_product_id: string | null
  stripe_price_id: string | null
}

type CreatorStripeRow = {
  id: string
  stripe_account_id: string | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const tierId = String(body.tierId || '')

    if (!tierId) {
      return NextResponse.json({ error: 'Tier fehlt.' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
    }

    const { data: tierRows, error: tierError } = await supabase
      .from('membership_tiers')
      .select(
        'id, creator_id, name, description, price_cents, currency, stripe_product_id, stripe_price_id'
      )
      .eq('id', tierId)
      .returns<TierRow[]>()

    if (tierError) {
      return NextResponse.json({ error: tierError.message }, { status: 500 })
    }

    const tier = tierRows?.[0] ?? null

    if (!tier) {
      return NextResponse.json({ error: 'Tier nicht gefunden.' }, { status: 404 })
    }

    if (tier.creator_id === user.id) {
      return NextResponse.json(
        { error: 'Du kannst deinen eigenen Tier nicht abonnieren.' },
        { status: 400 }
      )
    }

    const { data: creatorRows, error: creatorError } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', tier.creator_id)
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

    let stripeProductId = tier.stripe_product_id
    let stripePriceId = tier.stripe_price_id

    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: tier.name,
        description: tier.description || undefined,
        metadata: {
          creator_id: tier.creator_id,
          tier_id: tier.id,
          kind: 'membership_tier',
        },
      })

      stripeProductId = product.id

      const membershipTiers = supabase.from('membership_tiers') as any
      await membershipTiers
        .update({ stripe_product_id: stripeProductId })
        .eq('id', tier.id)
    }

    if (!stripePriceId) {
      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: tier.price_cents,
        currency: tier.currency.toLowerCase(),
        recurring: {
          interval: 'month',
        },
        metadata: {
          creator_id: tier.creator_id,
          tier_id: tier.id,
          kind: 'membership_tier_price',
        },
      })

      stripePriceId = price.id

      const membershipTiers = supabase.from('membership_tiers') as any
      await membershipTiers
        .update({ stripe_price_id: stripePriceId })
        .eq('id', tier.id)
    }

    const headerList = await headers()
    const origin =
      headerList.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: `${origin}/channel/${tier.creator_id}?membership=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/channel/${tier.creator_id}?membership=cancel`,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_PERCENT,
        transfer_data: {
          destination: creator.stripe_account_id,
        },
        metadata: {
          creator_id: tier.creator_id,
          tier_id: tier.id,
          member_id: user.id,
          platform_fee_percent: String(PLATFORM_FEE_PERCENT),
        },
      },
      metadata: {
        creator_id: tier.creator_id,
        tier_id: tier.id,
        member_id: user.id,
        platform_fee_percent: String(PLATFORM_FEE_PERCENT),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Checkout konnte nicht erstellt werden.',
      },
      { status: 500 }
    )
  }
}