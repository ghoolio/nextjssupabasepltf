import Link from 'next/link'
import { notFound } from 'next/navigation'
import HighlightViewer from '@/components/highlight-viewer'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type HighlightRow = {
  id: string
  creator_id: string
  title: string
  cover_story_id: string | null
  position: number
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
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

export default async function HighlightPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ story?: string }>
}) {
  const { id } = await params
  const qs = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: highlightRows } = await supabase
    .from('creator_highlights')
    .select('id, creator_id, title, cover_story_id, position')
    .eq('id', id)
    .returns<HighlightRow[]>()

  const highlight = highlightRows?.[0] ?? null

  if (!highlight) {
    notFound()
  }

  const { data: profileRows } = await supabase
    .from('public_profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', highlight.creator_id)
    .returns<ProfileRow[]>()

  const creator = profileRows?.[0] ?? null

  if (!creator) {
    notFound()
  }

  const { data: itemRows } = await supabase
    .from('creator_highlight_items')
    .select('highlight_id, story_id, position')
    .eq('highlight_id', highlight.id)
    .order('position', { ascending: true })
    .returns<HighlightItemRow[]>()

  const items = itemRows ?? []
  const storyIds = items.map((item) => item.story_id)

  if (storyIds.length === 0) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        Dieses Highlight enthält noch keine Stories.
      </main>
    )
  }

  const { data: storyRows } = await supabase
    .from('creator_stories')
    .select(
      'id, creator_id, media_type, file_path, thumbnail_path, caption, visibility_type, published_at, expires_at, created_at'
    )
    .in('id', storyIds)
    .returns<StoryRow[]>()

  const storyMap = new Map((storyRows ?? []).map((story) => [story.id, story]))
  const orderedStories = items
    .map((item) => storyMap.get(item.story_id))
    .filter(Boolean) as StoryRow[]

  if (orderedStories.length === 0) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        Dieses Highlight enthält keine verfügbaren Stories.
      </main>
    )
  }

  const creatorAvatarUrl = creator.avatar_url
    ? supabase.storage.from('profile-assets').getPublicUrl(creator.avatar_url).data.publicUrl
    : null

  const signedStories = await Promise.all(
    orderedStories.map(async (story) => {
      const signed = await supabaseAdmin.storage
        .from('stories')
        .createSignedUrl(story.file_path, 60 * 60)

      return {
        ...story,
        signed_url: signed.data?.signedUrl ?? null,
      }
    })
  )

  let initialIndex = 0
  if (qs.story) {
    const foundIndex = signedStories.findIndex((story) => story.id === qs.story)
    if (foundIndex >= 0) {
      initialIndex = foundIndex
    }
  }

  const isOwnHighlight = user?.id === highlight.creator_id

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute left-4 top-4 z-30 flex gap-3">
        <Link
          href={`/channel/${highlight.creator_id}`}
          className="rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/10 hover:text-white"
        >
          ← Zurück zum Kanal
        </Link>

        {isOwnHighlight ? (
          <Link
            href={`/highlights/${highlight.id}/edit`}
            className="rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/10 hover:text-white"
          >
            Bearbeiten
          </Link>
        ) : null}
      </div>

      <div className="flex min-h-screen items-center justify-center px-3 py-3 sm:px-4 sm:py-4">
        <HighlightViewer
          highlightId={highlight.id}
          highlightTitle={highlight.title}
          creatorId={highlight.creator_id}
          creatorName={creator.display_name || creator.username || 'Creator'}
          creatorAvatarUrl={creatorAvatarUrl}
          initialIndex={initialIndex}
          stories={signedStories.map((story) => ({
            id: story.id,
            media_type: story.media_type,
            signed_url: story.signed_url,
            caption: story.caption,
            visibility_type: story.visibility_type,
            published_at: story.published_at,
          }))}
        />
      </div>
    </main>
  )
}