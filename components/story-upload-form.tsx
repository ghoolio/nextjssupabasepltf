'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type VisibilityType = 'public' | 'followers' | 'members'
type MediaType = 'image' | 'video'

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const allowedVideoMimeTypes = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

const maxImageBytes = 10 * 1024 * 1024
const maxVideoBytes = 150 * 1024 * 1024

export default function StoryUploadForm({
  userId,
}: {
  userId: string
}) {
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [visibilityType, setVisibilityType] = useState<VisibilityType>('public')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mediaType = useMemo<MediaType | null>(() => {
    if (!file) return null
    if (allowedImageMimeTypes.has(file.type)) return 'image'
    if (allowedVideoMimeTypes.has(file.type)) return 'video'
    return null
  }, [file])

  const previewUrl = useMemo(() => {
    if (!file) return null
    return URL.createObjectURL(file)
  }, [file])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (!file) {
        throw new Error('Bitte wähle eine Datei für die Story aus.')
      }

      if (!mediaType) {
        throw new Error('Erlaubt sind JPG, PNG, WebP, MP4, WebM oder MOV.')
      }

      if (mediaType === 'image' && file.size > maxImageBytes) {
        throw new Error('Bild ist zu groß. Limit: 10 MB.')
      }

      if (mediaType === 'video' && file.size > maxVideoBytes) {
        throw new Error('Video ist zu groß. Limit: 150 MB.')
      }

      if (caption.trim().length > 280) {
        throw new Error('Die Caption darf maximal 280 Zeichen lang sein.')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('caption', caption.trim())
      formData.append('visibilityType', visibilityType)
      formData.append('userId', userId)

      const res = await fetch('/api/stories/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Story konnte nicht veröffentlicht werden.')
      }

      setSuccess('Story erfolgreich veröffentlicht.')
      router.push(`/channel/${userId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Story konnte nicht veröffentlicht werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-white"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm text-white/70">Story-Datei</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black"
            />
            <p className="text-xs text-white/35">
              Bilder: JPG, PNG, WebP bis 10 MB. Videos: MP4, WebM, MOV bis 150 MB.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-white/70">Sichtbarkeit</label>
            <select
              value={visibilityType}
              onChange={(e) => setVisibilityType(e.target.value as VisibilityType)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
            >
              <option value="public">Öffentlich</option>
              <option value="followers">Nur Follower</option>
              <option value="members">Nur Mitglieder</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-white/70">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={280}
              placeholder="Kurzer Text zur Story"
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-white/70">Vorschau</div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
            <div className="aspect-[9/16]">
              {previewUrl && mediaType === 'image' ? (
                <img
                  src={previewUrl}
                  alt="Story Vorschau"
                  className="h-full w-full object-cover"
                />
              ) : previewUrl && mediaType === 'video' ? (
                <video
                  src={previewUrl}
                  controls
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-white/35">
                  Wähle ein Bild oder Video, um die Story-Vorschau zu sehen.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
            Stories laufen standardmäßig nach 24 Stunden ab. Highlights bauen wir später darauf auf.
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Veröffentlicht...' : 'Story veröffentlichen'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:bg-white/10"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}