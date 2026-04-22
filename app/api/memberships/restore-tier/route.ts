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

type MembershipTierRestoreRow = {
  id: string
  creator_id: string
  stripe_product_id: string | null
  archived: boolean
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
      .select('id, creator_id, stripe_product_id, archived')
      .eq('id', tierId)
      .eq('creator_id', user.id)
      .returns<MembershipTierRestoreRow[]>()

    if (tierError) {
      return NextResponse.json({ error: tierError.message }, { status: 500 })
    }

    const tier = tierRows?.[0] ?? null

    if (!tier) {
      return NextResponse.json({ error: 'Tier nicht gefunden.' }, { status: 404 })
    }

    if (tier.stripe_product_id) {
      await stripe.products.update(tier.stripe_product_id, {
        active: true,
      })
    }

    const { error: restoreError } = await supabaseAdmin
      .from('membership_tiers')
      .update({
        archived: false,
      })
      .eq('id', tier.id)
      .eq('creator_id', user.id)

    if (restoreError) {
      return NextResponse.json({ error: restoreError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Tier konnte nicht wiederhergestellt werden.',
      },
      { status: 500 }
    )
  }
}