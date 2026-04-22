import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import EmptyState from '@/components/empty-state'
import DeleteVideoButton from '@/components/delete-video-button'
import { createClient } from '@/lib/supabase-server'

type MyVideoRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  thumbnail_path: string | null
  visibility_type: 'public' | 'paid' | 'members'
  payment_type: 'free' | 'paid'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
  created_at: string
}

export default async function MyVideosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: rows } = await supabase
    .from('videos')
    .select(
      'id, user_id, title, description, thumbnail_path, visibility_type, payment_type, price_cents, currency, created_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<MyVideoRow[]>()

  const videos = await Promise.all(
    (rows ?? []).map(async (video) => {
      if (!video.thumbnail_path) {
        return {
          ...video,
          thumbnail_url: null as string | null,
        }
      }

      const { data } = await supabase.storage
        .from('videos')
        .createSignedUrl(video.thumbnail_path, 60 * 60)

      return {
        ...video,
        thumbnail_url: data?.signedUrl ?? null,
      }
    })
  )

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Meine Videos
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Verwalte deine Uploads, Preise und Mitgliederinhalte.
              </p>
            </div>

            <Link
              href="/upload"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              Neues Video hochladen
            </Link>
          </div>

          {videos.length > 0 ? (
            <div className="space-y-4">
              {videos.map((video) => (
                <article
                  key={video.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                >
                  <div className="grid min-h-[190px] md:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="bg-black/30">
                      <div className="flex h-full min-h-[190px] items-center justify-center bg-black/40 p-3">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="h-full max-h-[190px] w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full min-h-[190px] w-full items-center justify-center text-sm text-white/35">
                            Kein Thumbnail
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col justify-between p-4">
                      <div>
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                          <span className="rounded-full border border-white/10 px-2.5 py-1">
                            {video.visibility_type === 'public'
                              ? 'Öffentlich'
                              : video.visibility_type === 'paid'
                                ? `Einzelkauf · ${((video.price_cents ?? 0) / 100).toFixed(2)} ${video.currency ?? 'EUR'}`
                                : 'Nur für Mitglieder'}
                          </span>

                          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-sky-200">
                            Dein Video
                          </span>
                        </div>

                        <h2 className="line-clamp-1 text-lg font-semibold text-white">
                          {video.title}
                        </h2>

                        <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-white/60">
                          {video.description || 'Keine Beschreibung vorhanden.'}
                        </p>

                        <div className="mt-3 text-xs text-white/35">
                          Erstellt am {new Date(video.created_at).toLocaleDateString('de-DE')}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/video/${video.id}`}
                          className="rounded-full border border-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/10"
                        >
                          Ansehen
                        </Link>

                        <Link
                          href={`/my-videos/${video.id}/edit`}
                          className="rounded-full bg-white px-3 py-2 text-sm font-medium text-black transition hover:opacity-90"
                        >
                          Bearbeiten
                        </Link>

                        <DeleteVideoButton videoId={video.id} />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Noch keine Videos"
              description="Lade dein erstes Video hoch und entscheide später, ob es kostenlos, kostenpflichtig oder nur für Mitglieder sichtbar sein soll."
            />
          )}
        </main>
      </AppFrame>
    </>
  )
}