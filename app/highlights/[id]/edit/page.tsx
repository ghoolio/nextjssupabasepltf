import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import AppFrame from '@/components/app-frame'
import HighlightEditForm from '@/components/highlight-edit-form'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type HighlightRow = {
  id: string
  creator_id: string
  title: string
  cover_story_id: string | null
  position: number
}

type HighlightItemRow = {
  highlight_id: string
  story_id: string
  position: number
}

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

export default async function EditHighlightPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: highlightRows } = await supabase
    .from('creator_highlights')
    .select('id, creator_id, title, cover_story_id, position')
    .eq('id', id)
    .returns<HighlightRow[]>()

  const highlight = highlightRows?.[0] ?? null

  if (!highlight || highlight.creator_id !== user.id) {
    notFound()
  }

  const { data: itemRows } = await supabase
    .from('creator_highlight_items')
    .select('highlight_id, story_id, position')
    .eq('highlight_id', highlight.id)
    .order('position', { ascending: true })
    .returns<HighlightItemRow[]>()

  const itemMap = new Map((itemRows ?? []).map((item) => [item.story_id, item.position]))

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
        selected: itemMap.has(story.id),
        current_position: itemMap.get(story.id) ?? null,
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
                href={`/highlights/${highlight.id}`}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/10"
              >
                Highlight ansehen
              </Link>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Highlight bearbeiten
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Verwalte Titel, Cover und enthaltene Stories dieses Highlights.
              </p>
            </div>
          </div>

          <HighlightEditForm
            highlightId={highlight.id}
            creatorId={user.id}
            initialTitle={highlight.title}
            initialCoverStoryId={highlight.cover_story_id}
            stories={stories.map((story) => ({
              id: story.id,
              media_type: story.media_type,
              caption: story.caption,
              visibility_type: story.visibility_type,
              published_at: story.published_at,
              preview_url: story.preview_url,
              selected: story.selected,
              current_position: story.current_position,
            }))}
          />
        </main>
      </AppFrame>
    </>
  )
}