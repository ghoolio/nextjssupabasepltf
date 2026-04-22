import Link from 'next/link'
import { notFound } from 'next/navigation'
import StoryViewer from '@/components/story-viewer'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
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

export default async function CreatorStoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ creatorId: string }>
  searchParams: Promise<{ story?: string }>
}) {
  const { creatorId } = await params
  const qs = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', creatorId)
    .returns<ProfileRow[]>()

  const creator = profileRows?.[0] ?? null

  if (!creator) {
    notFound()
  }

  const nowIso = new Date().toISOString()

  const { data: storyRows } = await supabase
    .from('creator_stories')
    .select(
      'id, creator_id, media_type, file_path, thumbnail_path, caption, visibility_type, published_at, expires_at, created_at'
    )
    .eq('creator_id', creatorId)
    .gt('expires_at', nowIso)
    .order('published_at', { ascending: true })
    .returns<StoryRow[]>()

  const stories = storyRows ?? []

  if (stories.length === 0) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white">
        Keine aktiven Stories gefunden.
      </main>
    )
  }

  if (user) {
    await Promise.all(
      stories.map((story) =>
        (supabase.from('creator_story_views') as any).upsert(
          {
            story_id: story.id,
            viewer_id: user.id,
          },
          { onConflict: 'story_id,viewer_id' }
        )
      )
    )
  }

  const creatorAvatarUrl = creator.avatar_url
    ? supabase.storage.from('profile-assets').getPublicUrl(creator.avatar_url).data.publicUrl
    : null

  const signedStories = await Promise.all(
    stories.map(async (story) => {
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

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute left-4 top-4 z-30">
        <Link
          href={`/channel/${creatorId}`}
          className="rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur transition hover:bg-white/10 hover:text-white"
        >
          ← Zurück zum Kanal
        </Link>
      </div>

      <div className="flex min-h-screen items-center justify-center px-3 py-3 sm:px-4 sm:py-4">
        <StoryViewer
          creatorId={creatorId}
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