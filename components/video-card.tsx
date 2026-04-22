import Link from 'next/link'

type Video = {
  id: string
  title: string
  description: string | null
  thumbnail_url?: string | null
  payment_type?: 'free' | 'paid'
  price_cents?: number | null
  currency?: 'EUR' | 'USD' | null
  visibility_type?: 'public' | 'paid' | 'members'
  purchased?: boolean
  owned?: boolean
  creator_id?: string
  creator_name?: string | null
  creator_avatar_signed_url?: string | null
}

export default function VideoCard({ video }: { video: Video }) {
  const isPaid = video.payment_type === 'paid' || video.visibility_type === 'paid'
  const isMembersOnly = video.visibility_type === 'members'

  return (
    <div className="group block text-white">
      <Link href={`/video/${video.id}`} className="block">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10 transition group-hover:ring-white/20">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-xs text-white/35">
              Kein Thumbnail
            </div>
          )}

          <div className="absolute bottom-2 right-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={`rounded-full px-2.5 py-1 backdrop-blur ${
                isMembersOnly
                  ? 'bg-fuchsia-400/90 text-black'
                  : isPaid
                    ? 'bg-amber-400/90 text-black'
                    : 'bg-black/75 text-white ring-1 ring-white/10'
              }`}
            >
              {isMembersOnly
                ? 'Mitglieder'
                : isPaid
                  ? `${((video.price_cents ?? 0) / 100).toFixed(2)} ${video.currency ?? 'EUR'}`
                  : 'Kostenlos'}
            </span>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex gap-3">
        <Link
          href={video.creator_id ? `/channel/${video.creator_id}` : '#'}
          className="mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10"
        >
          {video.creator_avatar_signed_url ? (
            <img
              src={video.creator_avatar_signed_url}
              alt={video.creator_name || 'Creator'}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-white/50">
              {(video.creator_name?.[0] || 'V').toUpperCase()}
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={`/video/${video.id}`} className="block">
            <h3 className="line-clamp-2 text-sm font-medium leading-5 text-white">
              {video.title}
            </h3>
          </Link>

          <Link
            href={video.creator_id ? `/channel/${video.creator_id}` : '#'}
            className="mt-1 block text-xs text-white/45 transition hover:text-white/80"
          >
            {video.creator_name || 'Unbekannter Creator'}
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
            {video.purchased ? (
              <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-emerald-200 ring-1 ring-emerald-400/20">
                Freigeschaltet
              </span>
            ) : null}

            {video.owned ? (
              <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-sky-200 ring-1 ring-sky-400/20">
                Dein Video
              </span>
            ) : null}
          </div>

          <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/45">
            {video.description || 'Keine Beschreibung vorhanden.'}
          </p>
        </div>
      </div>
    </div>
  )
}