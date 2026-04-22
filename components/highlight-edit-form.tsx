'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type StoryOption = {
  id: string
  media_type: 'image' | 'video'
  caption: string | null
  visibility_type: 'public' | 'followers' | 'members'
  published_at: string
  preview_url: string | null
  selected: boolean
  current_position: number | null
}

function sortInitialStories(stories: StoryOption[]) {
  return [...stories].sort((a, b) => {
    const aSelected = a.selected ? 0 : 1
    const bSelected = b.selected ? 0 : 1

    if (aSelected !== bSelected) return aSelected - bSelected

    if (a.selected && b.selected) {
      return (a.current_position ?? 9999) - (b.current_position ?? 9999)
    }

    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  })
}

export default function HighlightEditForm({
  highlightId,
  creatorId,
  initialTitle,
  initialCoverStoryId,
  stories,
}: {
  highlightId: string
  creatorId: string
  initialTitle: string
  initialCoverStoryId: string | null
  stories: StoryOption[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(initialTitle)
  const [orderedStories, setOrderedStories] = useState<StoryOption[]>(() =>
    sortInitialStories(stories)
  )
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>(
    stories
      .filter((story) => story.selected)
      .sort((a, b) => (a.current_position ?? 9999) - (b.current_position ?? 9999))
      .map((story) => story.id)
  )
  const [coverStoryId, setCoverStoryId] = useState<string>(initialCoverStoryId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedSet = useMemo(() => new Set(selectedStoryIds), [selectedStoryIds])

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

  function moveSelectedStory(storyId: string, direction: 'up' | 'down') {
    setSelectedStoryIds((prev) => {
      const index = prev.indexOf(storyId)
      if (index === -1) return prev

      const next = [...prev]
      const swapIndex = direction === 'up' ? index - 1 : index + 1

      if (swapIndex < 0 || swapIndex >= next.length) return prev

      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
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

      const finalCoverStoryId = coverStoryId || selectedStoryIds[0]

      const { error: highlightError } = await (supabase
        .from('creator_highlights') as any)
        .update({
          title: title.trim(),
          cover_story_id: finalCoverStoryId,
        })
        .eq('id', highlightId)
        .eq('creator_id', creatorId)

      if (highlightError) {
        throw new Error(highlightError.message)
      }

      const { error: deleteError } = await (supabase
        .from('creator_highlight_items') as any)
        .delete()
        .eq('highlight_id', highlightId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      const items = selectedStoryIds.map((storyId, index) => ({
        highlight_id: highlightId,
        story_id: storyId,
        position: index,
      }))

      const { error: insertError } = await (supabase
        .from('creator_highlight_items') as any)
        .insert(items)

      if (insertError) {
        throw new Error(insertError.message)
      }

      setSuccess('Highlight erfolgreich aktualisiert.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Highlight konnte nicht gespeichert werden.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Willst du dieses Highlight wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
    )

    if (!confirmed) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error } = await (supabase.from('creator_highlights') as any)
        .delete()
        .eq('id', highlightId)
        .eq('creator_id', creatorId)

      if (error) {
        throw new Error(error.message)
      }

      router.push(`/channel/${creatorId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Highlight konnte nicht gelöscht werden.')
      setLoading(false)
    }
  }

  const selectedStories = selectedStoryIds
    .map((id) => orderedStories.find((story) => story.id === id))
    .filter(Boolean) as StoryOption[]

  return (
    <form
      onSubmit={handleSave}
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
        <div className="text-sm text-white/70">Ausgewählte Stories</div>

        {selectedStories.length > 0 ? (
          <div className="space-y-3">
            {selectedStories.map((story, index) => (
              <div
                key={story.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
              >
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
                  {story.preview_url ? (
                    <img
                      src={story.preview_url}
                      alt={story.caption || 'Story'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-white/35">
                      Keine
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm text-white/80">
                    {story.caption || 'Keine Caption'}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Position {index + 1}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-white/60">
                  <input
                    type="radio"
                    name="coverStory"
                    checked={coverStoryId === story.id}
                    onChange={() => setCoverStoryId(story.id)}
                  />
                  Cover
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveSelectedStory(story.id, 'up')}
                    disabled={index === 0}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/10 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedStory(story.id, 'down')}
                    disabled={index === selectedStories.length - 1}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/10 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            Noch keine Stories ausgewählt.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-sm text-white/70">Stories auswählen</div>

        {orderedStories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {orderedStories.map((story) => {
              const selected = selectedSet.has(story.id)

              return (
                <div
                  key={story.id}
                  className={`overflow-hidden rounded-2xl border ${
                    selected
                      ? 'border-fuchsia-400/40 bg-fuchsia-400/10'
                      : 'border-white/10 bg-black/20'
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
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            Du hast noch keine Stories.
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Speichert...' : 'Änderungen speichern'}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/channel/${creatorId}`)}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:bg-white/10"
        >
          Abbrechen
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="rounded-full border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm text-red-300 transition hover:bg-red-400/20 disabled:opacity-60"
        >
          Highlight löschen
        </button>
      </div>
    </form>
  )
}