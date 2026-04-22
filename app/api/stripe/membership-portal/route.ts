import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase-server'

type MembershipRow = {
  creator_id: string
  member_id: string
  status: 'active' | 'canceled' | 'expired'
  stripe_customer_id: string | null
}

function normalizeReturnPath(returnPath: string | null | undefined, creatorId: string) {
  if (!returnPath || typeof returnPath !== 'string') {
    return `/channel/${creatorId}`
  }

  if (!returnPath.startsWith('/')) {
    return `/channel/${creatorId}`
  }

  if (returnPath.startsWith('//')) {
    return `/channel/${creatorId}`
  }

  return returnPath
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const creatorId = String(body.creatorId || '')
    const returnPath = normalizeReturnPath(body.returnPath, creatorId)

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator fehlt.' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
    }

    const { data: membershipRows } = await supabase
      .from('creator_memberships')
      .select('creator_id, member_id, status, stripe_customer_id')
      .eq('creator_id', creatorId)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .returns<MembershipRow[]>()

    const membership = membershipRows?.[0] ?? null

    if (!membership) {
      return NextResponse.json(
        { error: 'Keine aktive Mitgliedschaft gefunden.' },
        { status: 404 }
      )
    }

    if (!membership.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Kein Stripe-Kunde für diese Mitgliedschaft hinterlegt.' },
        { status: 400 }
      )
    }

    const headerList = await headers()
    const origin =
      headerList.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const session = await stripe.billingPortal.sessions.create({
      customer: membership.stripe_customer_id,
      return_url: `${origin}${returnPath}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Billing Portal konnte nicht geöffnet werden.',
      },
      { status: 500 }
    )
  }
}