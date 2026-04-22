import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ProfileStripeRow = {
  id: string
  stripe_account_id: string | null
}

export async function POST() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .returns<ProfileStripeRow[]>()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const profile = profileRows?.[0] ?? null

    if (!profile?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Kein verbundenes Stripe-Konto vorhanden.' },
        { status: 400 }
      )
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id)

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_onboarding_completed:
          Boolean(account.details_submitted) &&
          Boolean(account.charges_enabled) &&
          Boolean(account.payouts_enabled),
        stripe_charges_enabled: Boolean(account.charges_enabled),
        stripe_payouts_enabled: Boolean(account.payouts_enabled),
        stripe_details_submitted: Boolean(account.details_submitted),
      })
      .eq('id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      stripe_account_id: account.id,
      details_submitted: Boolean(account.details_submitted),
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Stripe-Status konnte nicht synchronisiert werden.',
      },
      { status: 500 }
    )
  }
}