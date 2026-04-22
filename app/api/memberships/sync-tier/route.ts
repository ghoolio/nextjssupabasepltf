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
  tierId?: string
  name: string
  description?: string
  price_cents: number
  currency: 'EUR' | 'USD'
  position: number
}

type MembershipTierRow = {
  id: string
  creator_id: string
  stripe_product_id: string | null
  stripe_price_id: string | null
  name: string
  description: string | null
  price_cents: number
  currency: 'EUR' | 'USD'
  position: number
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

    const tierId = body.tierId || null
    const name = body.name?.trim()
    const description = body.description?.trim() || null
    const priceCents = body.price_cents
    const currency = body.currency
    const position = body.position

    if (!name || name.length < 2 || name.length > 40) {
      return NextResponse.json(
        { error: 'Der Tier-Name muss zwischen 2 und 40 Zeichen lang sein.' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      return NextResponse.json(
        { error: 'Der Preis muss als positive Ganzzahl in Cent übergeben werden.' },
        { status: 400 }
      )
    }

    if (!['EUR', 'USD'].includes(currency)) {
      return NextResponse.json({ error: 'Ungültige Währung.' }, { status: 400 })
    }

    if (!Number.isInteger(position) || position < 0) {
      return NextResponse.json({ error: 'Ungültige Position.' }, { status: 400 })
    }

    let existingTier: MembershipTierRow | null = null

    if (tierId) {
      const { data: tierRows, error } = await supabase
        .from('membership_tiers')
        .select(
          'id, creator_id, stripe_product_id, stripe_price_id, name, description, price_cents, currency, position'
        )
        .eq('id', tierId)
        .eq('creator_id', user.id)
        .returns<MembershipTierRow[]>()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      existingTier = tierRows?.[0] ?? null

      if (!existingTier) {
        return NextResponse.json({ error: 'Tier nicht gefunden.' }, { status: 404 })
      }
    }

    let stripeProductId: string | null = existingTier?.stripe_product_id ?? null
    let stripePriceId: string | null = existingTier?.stripe_price_id ?? null

    if (!stripeProductId) {
      const product = await stripe.products.create({
        name,
        description: description || undefined,
        metadata: {
          creator_id: user.id,
          kind: 'membership_tier',
          local_tier_id: existingTier?.id || '',
        },
      })

      stripeProductId = product.id
    } else {
      await stripe.products.update(stripeProductId, {
        name,
        description: description || undefined,
        metadata: {
          creator_id: user.id,
          kind: 'membership_tier',
          local_tier_id: existingTier?.id || '',
        },
      })
    }

    const needsNewPrice =
      !existingTier ||
      !stripePriceId ||
      existingTier.price_cents !== priceCents ||
      existingTier.currency !== currency

    if (needsNewPrice) {
      const price = await stripe.prices.create({
        unit_amount: priceCents,
        currency: currency.toLowerCase(),
        recurring: {
          interval: 'month',
        },
        product: stripeProductId,
        metadata: {
          creator_id: user.id,
          kind: 'membership_tier_price',
          local_tier_id: existingTier?.id || '',
        },
      })

      stripePriceId = price.id
    }

    if (existingTier) {
      const { data: updatedRows, error } = await supabaseAdmin
        .from('membership_tiers')
        .update({
          name,
          description,
          price_cents: priceCents,
          currency,
          position,
          stripe_product_id: stripeProductId,
          stripe_price_id: stripePriceId,
          archived: false,
        })
        .eq('id', existingTier.id)
        .eq('creator_id', user.id)
        .select(
          'id, creator_id, stripe_product_id, stripe_price_id, name, description, price_cents, currency, position'
        )
        .returns<MembershipTierRow[]>()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const updatedTier = updatedRows?.[0] ?? null

      if (!updatedTier) {
        return NextResponse.json(
          { error: 'Tier konnte nicht aktualisiert werden.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ tier: updatedTier })
    }

    const { data: insertedRows, error } = await supabaseAdmin
      .from('membership_tiers')
      .insert({
        creator_id: user.id,
        name,
        description,
        price_cents: priceCents,
        currency,
        position,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        archived: false,
      })
      .select(
        'id, creator_id, stripe_product_id, stripe_price_id, name, description, price_cents, currency, position'
      )
      .returns<MembershipTierRow[]>()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const insertedTier = insertedRows?.[0] ?? null

    if (!insertedTier) {
      return NextResponse.json(
        { error: 'Tier konnte nicht erstellt werden.' },
        { status: 500 }
      )
    }

    if (insertedTier.id && stripeProductId) {
      await stripe.products.update(stripeProductId, {
        metadata: {
          creator_id: user.id,
          kind: 'membership_tier',
          local_tier_id: insertedTier.id,
        },
      })
    }

    return NextResponse.json({ tier: insertedTier })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Tier-Sync fehlgeschlagen.',
      },
      { status: 500 }
    )
  }
}