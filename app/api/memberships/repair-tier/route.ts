import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY fehlt.')
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2026-03-25.dahlia',
})

type RequestBody = {
  tierId: string
}

type MembershipTierRow = {
  id: string
  creator_id: string
  name: string
  description: string | null
  price_cents: number
  currency: 'EUR' | 'USD'
  position: number
  archived: boolean
  stripe_product_id: string | null
  stripe_price_id: string | null
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
    }

    const body = (await req.json()) as RequestBody
    const tierId = body.tierId?.trim()

    if (!tierId) {
      return NextResponse.json({ error: 'tierId fehlt.' }, { status: 400 })
    }

    const { data: tierRows, error: tierError } = await supabase
      .from('membership_tiers')
      .select(
        'id, creator_id, name, description, price_cents, currency, position, archived, stripe_product_id, stripe_price_id'
      )
      .eq('id', tierId)
      .eq('creator_id', user.id)
      .returns<MembershipTierRow[]>()

    if (tierError) {
      return NextResponse.json({ error: tierError.message }, { status: 500 })
    }

    const tier = tierRows?.[0] ?? null

    if (!tier) {
      return NextResponse.json({ error: 'Tier nicht gefunden.' }, { status: 404 })
    }

    if (tier.archived) {
      return NextResponse.json(
        { error: 'Archivierte Tiers werden nicht repariert.' },
        { status: 400 }
      )
    }

    let stripeProductId = tier.stripe_product_id
    let stripePriceId = tier.stripe_price_id

    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: tier.name,
        description: tier.description || undefined,
        active: true,
        metadata: {
          creator_id: user.id,
          kind: 'membership_tier',
          local_tier_id: tier.id,
        },
      })

      stripeProductId = product.id
    } else {
      await stripe.products.update(stripeProductId, {
        name: tier.name,
        description: tier.description || undefined,
        active: true,
        metadata: {
          creator_id: user.id,
          kind: 'membership_tier',
          local_tier_id: tier.id,
        },
      })
    }

    if (!stripePriceId) {
      const price = await stripe.prices.create({
        unit_amount: tier.price_cents,
        currency: tier.currency.toLowerCase(),
        recurring: {
          interval: 'month',
        },
        product: stripeProductId,
        metadata: {
          creator_id: user.id,
          kind: 'membership_tier_price',
          local_tier_id: tier.id,
        },
      })

      stripePriceId = price.id
    }

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('membership_tiers')
      .update({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        archived: false,
      })
      .eq('id', tier.id)
      .eq('creator_id', user.id)
      .select(
        'id, creator_id, name, description, price_cents, currency, position, archived, stripe_product_id, stripe_price_id'
      )
      .returns<MembershipTierRow[]>()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const updatedTier = updatedRows?.[0] ?? null

    if (!updatedTier) {
      return NextResponse.json(
        { error: 'Tier konnte nicht aktualisiert werden.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tier: updatedTier })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Tier konnte nicht repariert werden.',
      },
      { status: 500 }
    )
  }
}