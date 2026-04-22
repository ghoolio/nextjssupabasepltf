import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
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

    if (!profile) {
      return NextResponse.json({ error: 'Profil nicht gefunden.' }, { status: 404 })
    }

    let stripeAccountId = profile.stripe_account_id

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email || undefined,
        metadata: {
          user_id: user.id,
          kind: 'creator_connect_account',
        },
      })

      stripeAccountId = account.id

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          stripe_account_id: stripeAccountId,
        })
        .eq('id', user.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    const headerList = await headers()
    const origin =
      headerList.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/settings/creator?stripe=refresh`,
      return_url: `${origin}/settings/creator?stripe=return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Stripe Connect konnte nicht gestartet werden.',
      },
      { status: 500 }
    )
  }
}