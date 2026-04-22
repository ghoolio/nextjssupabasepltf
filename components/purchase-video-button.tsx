'use client'

import { useTransition } from 'react'

export default function PurchaseVideoButton({
  videoId,
  label,
}: {
  videoId: string
  label?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId }),
          })

          const text = await res.text()
          let data: any = {}

          try {
            data = text ? JSON.parse(text) : {}
          } catch {
            data = { error: text || 'Ungültige Server-Antwort.' }
          }

          if (!res.ok) {
            alert(data.error || 'Checkout konnte nicht gestartet werden.')
            return
          }

          if (data.url) {
            window.location.href = data.url
            return
          }

          alert('Keine Checkout-URL erhalten.')
        })
      }}
      className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? 'Weiter zu Stripe...' : label || 'Jetzt kaufen'}
    </button>
  )
}