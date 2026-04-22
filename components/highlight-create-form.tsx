'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type StoryOption = {
  id: string
  media_type: 'image' | 'video'
  caption: string | null
  visibility_type: 'public' | 'followers' | 'members'
  published_at: string
  preview_url: string | null
}

export default function HighlightCreateForm({
  creatorId,
  stories,
}: {
  creatorId: string
  stories: StoryOption[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([])
  const [coverStoryId, setCoverStoryId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function toggleStory(storyId: string) {
    setSelectedStoryIds((prev) => {
      if (prev.includes(storyId)) {
        const next = prev.filter((id) => id !== storyId)
        if (coverStoryId === storyId) {
          setCoverStoryId(next[0] || '')
        }
        return next
      }

      const next = [...prev, storyId]
      if (!coverStoryId) {
        setCoverStoryId(storyId)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (title.trim().length < 2 || title.trim().length > 40) {
        throw new Error('Der Highlight-Titel muss zwischen 2 und 40 Zeichen lang sein.')
      }

      if (selectedStoryIds.length === 0) {
        throw new Error('Bitte wähle mindestens eine Story aus.')
      }

      const supabase = createClient()

      const { data: highlightRows, error: highlightError } = await (supabase
        .from('creator_highlights') as any)
        .insert({
          creator_id: creatorId,
          title: title.trim(),
          cover_story_id: coverStoryId || selectedStoryIds[0],
        })
        .select('id')
        .limit(1)

      if (highlightError) {
        throw new Error(highlightError.message)
      }

      const highlightId = highlightRows?.[0]?.id as string | undefined

      if (!highlightId) {
        throw new Error('Highlight konnte nicht erstellt werden.')
      }

      const items = selectedStoryIds.map((storyId, index) => ({
        highlight_id: highlightId,
        story_id: storyId,
        position: index,
      }))

      const { error: itemsError } = await (supabase
        .from('creator_highlight_items') as any)
        .insert(items)

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      setSuccess('Highlight erfolgreich erstellt.')
      router.push(`/channel/${creatorId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Highlight konnte nicht erstellt werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-white"
    >
      <div className="space-y-2">
        <label className="block text-sm text-white/70">Titel</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={40}
          placeholder="z. B. Behind the Scenes"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
        />
      </div>

      <div className="space-y-3">
        <div className="text-sm text-white/70">Stories auswählen</div>

        {stories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stories.map((story) => {
              const selected = selectedStoryIds.includes(story.id)
              const isCover = coverStoryId === story.id

              return (
                <div
                  key={story.id}
                  className={`overflow-hidden rounded-2xl border ${
                    selected ? 'border-fuchsia-400/40 bg-fuchsia-400/10' : 'border-white/10 bg-black/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleStory(story.id)}
                    className="block w-full text-left"
                  >
                    <div className="aspect-[9/16] overflow-hidden bg-black">
                      {story.preview_url ? (
                        <img
                          src={story.preview_url}
                          alt={story.caption || 'Story'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-white/35">
                          Keine Vorschau
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 p-4">
                      <div className="flex flex-wrap gap-2 text-xs text-white/45">
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          {story.media_type === 'image' ? 'Bild' : 'Video'}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          {story.visibility_type === 'public'
                            ? 'Öffentlich'
                            : story.visibility_type === 'followers'
                              ? 'Follower'
                              : 'Mitglieder'}
                        </span>
                      </div>

                      <div className="line-clamp-2 text-sm text-white/75">
                        {story.caption || 'Keine Caption'}
                      </div>

                      <div className="text-xs text-white/35">
                        {new Date(story.published_at).toLocaleString('de-DE')}
                      </div>
                    </div>
                  </button>

                  {selected ? (
                    <div className="border-t border-white/10 px-4 py-3">
                      <label className="flex items-center gap-2 text-xs text-white/70">
                        <input
                          type="radio"
                          name="coverStory"
                          checked={isCover}
                          onChange={() => setCoverStoryId(story.id)}
                        />
                        Als Cover verwenden
                      </label>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            Du hast noch keine Stories, aus denen ein Highlight erstellt werden könnte.
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading || stories.length === 0}
          className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Erstellt...' : 'Highlight erstellen'}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/channel/${creatorId}`)}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:bg-white/10"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}