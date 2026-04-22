import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PLATFORM_FEE_PERCENT = 10

function calculateFeeAmount(amountCents: number) {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100))
}

export async function POST(req: Request) {
  const body = await req.text()
  const headerList = await headers()
  const signature = headerList.get('stripe-signature')

  if (!signature) {
    return new NextResponse('Missing signature', { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return new NextResponse(
      `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      { status: 400 }
    )
  }

  const adminDb = supabaseAdmin as any

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.mode === 'payment') {
        const videoId = session.metadata?.videoId
        const buyerId = session.metadata?.buyerId
        const amount = session.amount_total
        const currency = session.currency?.toUpperCase()

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null

        if (!videoId || !buyerId) {
          return new NextResponse('Missing payment metadata', { status: 400 })
        }

        if (!amount || (currency !== 'EUR' && currency !== 'USD')) {
          return new NextResponse('Invalid payment amount/currency', { status: 400 })
        }

        const platformFeeAmount = calculateFeeAmount(amount)
        const creatorNetAmount = amount - platformFeeAmount

        const { error } = await adminDb
          .from('video_purchases')
          .upsert(
            [
              {
                video_id: videoId,
                buyer_id: buyerId,
                amount_cents: amount,
                currency,
                payment_status: 'paid',
                provider: 'stripe',
                provider_payment_id: session.id,
                stripe_payment_intent_id: paymentIntentId,
                platform_fee_percent: PLATFORM_FEE_PERCENT,
                platform_fee_amount_cents: platformFeeAmount,
                creator_net_amount_cents: creatorNetAmount,
              },
            ],
            { onConflict: 'video_id,buyer_id' }
          )

        if (error) {
          console.error('Webhook DB error (video purchase):', error)
          return new NextResponse('Database error', { status: 500 })
        }
      }

      if (session.mode === 'subscription') {
        let subscriptionId: string | null = null

        if (session.subscription) {
          subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
        }

        let subscription: Stripe.Subscription | null = null

        if (subscriptionId) {
          subscription = await stripe.subscriptions.retrieve(subscriptionId)
        }

        const creatorId =
          session.metadata?.creator_id || subscription?.metadata?.creator_id || null
        const tierId =
          session.metadata?.tier_id || subscription?.metadata?.tier_id || null
        const memberId =
          session.metadata?.member_id || subscription?.metadata?.member_id || null

        const currentPeriodEnd =
          subscription?.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : null

        const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end)
        const cancelAt = subscription?.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : null

        if (!creatorId || !tierId || !memberId) {
          return new NextResponse('Missing subscription metadata', { status: 400 })
        }

        const { error } = await adminDb
          .from('creator_memberships')
          .upsert(
            [
              {
                creator_id: creatorId,
                member_id: memberId,
                tier_id: tierId,
                status: 'active',
                provider: 'stripe',
                provider_subscription_id: subscriptionId,
                stripe_customer_id:
                  typeof session.customer === 'string'
                    ? session.customer
                    : session.customer?.id || null,
                current_period_end: currentPeriodEnd,
                cancel_at_period_end: cancelAtPeriodEnd,
                cancel_at: cancelAt,
              },
            ],
            { onConflict: 'creator_id,member_id' }
          )

        if (error) {
          console.error('Webhook DB error (membership):', error)
          return new NextResponse('Database error', { status: 500 })
        }
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object as Stripe.Invoice

        const rawSubscription =
            invoice.parent?.type === 'subscription_details'
                ? invoice.parent.subscription_details?.subscription ?? null
                : null

        const subscriptionId =
            typeof rawSubscription === 'string'
                ? rawSubscription
                : rawSubscription?.id ?? null

        if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)

            const creatorId = subscription.metadata?.creator_id || null
            const tierId = subscription.metadata?.tier_id || null
            const memberId = subscription.metadata?.member_id || null
            const amountPaid = invoice.amount_paid
            const currency = invoice.currency?.toUpperCase()

            if (
            creatorId &&
            tierId &&
            memberId &&
            amountPaid &&
            (currency === 'EUR' || currency === 'USD')
            ) {
            const platformFeeAmount = calculateFeeAmount(amountPaid)
            const creatorNetAmount = amountPaid - platformFeeAmount

            const { error } = await adminDb
                .from('membership_payments')
                .upsert(
                [
                    {
                    creator_id: creatorId,
                    member_id: memberId,
                    tier_id: tierId,
                    amount_cents: amountPaid,
                    currency,
                    platform_fee_percent: PLATFORM_FEE_PERCENT,
                    platform_fee_amount_cents: platformFeeAmount,
                    creator_net_amount_cents: creatorNetAmount,
                    provider: 'stripe',
                    provider_invoice_id: invoice.id,
                    provider_subscription_id: subscriptionId,
                    payment_status: 'paid',
                    paid_at: new Date(
                        (invoice.status_transitions?.paid_at || Math.floor(Date.now() / 1000)) * 1000
                    ).toISOString(),
                    },
                ],
                { onConflict: 'provider_invoice_id' }
                )

            if (error) {
                console.error('Membership payment insert error:', error)
                return new NextResponse('Database error', { status: 500 })
            }
            }
        }
    }

    if (event.type === 'refund.created') {
      const refund = event.data.object as Stripe.Refund

      const paymentIntentId =
        typeof refund.payment_intent === 'string'
          ? refund.payment_intent
          : refund.payment_intent?.id || null

      if (paymentIntentId) {
        const { error } = await adminDb
          .from('video_purchases')
          .update({
            payment_status: 'refunded',
          })
          .eq('stripe_payment_intent_id', paymentIntentId)

        if (error) {
          console.error('Refund update error (payment intent):', error)
          return new NextResponse('Database error', { status: 500 })
        }
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge

      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id || null

      if (paymentIntentId) {
        const { error } = await adminDb
          .from('video_purchases')
          .update({
            payment_status: 'refunded',
          })
          .eq('stripe_payment_intent_id', paymentIntentId)

        if (error) {
          console.error('Refund update error (charge):', error)
          return new NextResponse('Database error', { status: 500 })
        }
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription

      const nextStatus =
        subscription.status === 'active' || subscription.status === 'trialing'
          ? 'active'
          : subscription.status === 'canceled' || subscription.status === 'unpaid'
            ? 'canceled'
            : 'expired'

      const currentPeriodEnd = subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null

      const cancelAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null

      const cancelAtPeriodEnd =
        Boolean(subscription.cancel_at_period_end) || Boolean(subscription.cancel_at)

      const { error } = await adminDb
        .from('creator_memberships')
        .update({
          status: nextStatus,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          cancel_at: cancelAt,
        })
        .eq('provider_subscription_id', subscription.id)

      if (error) {
        console.error('Membership status update error:', error)
        return new NextResponse('Database error', { status: 500 })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription

      const currentPeriodEnd = subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null

      const cancelAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null

      const { error } = await adminDb
        .from('creator_memberships')
        .update({
          status: 'canceled',
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: false,
          cancel_at: cancelAt,
        })
        .eq('provider_subscription_id', subscription.id)

      if (error) {
        console.error('Membership delete error:', error)
        return new NextResponse('Database error', { status: 500 })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new NextResponse('Webhook handler failed', { status: 500 })
  }
}