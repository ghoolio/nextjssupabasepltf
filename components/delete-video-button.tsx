'use client'

import { useTransition } from 'react'
import { deleteVideo } from '@/lib/actions'

export default function DeleteVideoButton({
  videoId,
}: {
  videoId: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const ok = window.confirm('Willst du dieses Video wirklich löschen?')
        if (!ok) return

        startTransition(async () => {
          await deleteVideo(videoId)
        })
      }}
      className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
    >
      {pending ? 'Lösche...' : 'Video löschen'}
    </button>
  )
}