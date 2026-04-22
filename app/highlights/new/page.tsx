import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import HighlightCreateForm from '@/components/highlight-create-form'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type StoryRow = {
  id: string
  creator_id: string
  media_type: 'image' | 'video'
  file_path: string
  thumbnail_path: string | null
  caption: string | null
  visibility_type: 'public' | 'followers' | 'members'
  published_at: string
  expires_at: string
  created_at: string
}

export default async function NewHighlightPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: storyRows } = await supabase
    .from('creator_stories')
    .select(
      'id, creator_id, media_type, file_path, thumbnail_path, caption, visibility_type, published_at, expires_at, created_at'
    )
    .eq('creator_id', user.id)
    .order('published_at', { ascending: false })
    .returns<StoryRow[]>()

  const stories = await Promise.all(
    (storyRows ?? []).map(async (story) => {
      const previewPath = story.thumbnail_path || story.file_path

      const signed = await supabaseAdmin.storage
        .from('stories')
        .createSignedUrl(previewPath, 60 * 60)

      return {
        ...story,
        preview_url: signed.data?.signedUrl ?? null,
      }
    })
  )

  return (
    <>
      <SiteHeader userEmail={user.email} />
      <AppFrame>
        <main className="px-4 py-6 pb-24 md:px-6 lg:pb-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <Link
                href={`/channel/${user.id}`}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                ← Zurück zum Kanal
              </Link>

              <Link
                href="/stories/new"
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                Story posten
              </Link>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Neues Highlight
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Erstelle eine Highlight-Sammlung aus deinen vorhandenen Stories.
              </p>
            </div>
          </div>

          <HighlightCreateForm
            creatorId={user.id}
            stories={stories.map((story) => ({
              id: story.id,
              media_type: story.media_type,
              caption: story.caption,
              visibility_type: story.visibility_type,
              published_at: story.published_at,
              preview_url: story.preview_url,
            }))}
          />
        </main>
      </AppFrame>
    </>
  )
}