'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type VisibilityType = 'public' | 'paid' | 'members'

type VideoUpdatePayload = {
  title: string
  description: string | null
  thumbnail_path: string | null
  visibility_type: VisibilityType
  payment_type: 'free' | 'paid'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
}

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const maxThumbnailBytes = 8 * 1024 * 1024

export default function EditVideoForm({
  videoId,
  userId,
  paymentsEnabled,
  initialValues,
}: {
  videoId: string
  userId: string
  paymentsEnabled: boolean
  initialValues: {
    title: string
    description: string
    visibility_type: VisibilityType
    price_cents: number | null
    thumbnail_path: string | null
    thumbnail_preview_url: string | null
  }
}) {
  const router = useRouter()

  const [title, setTitle] = useState(initialValues.title)
  const [description, setDescription] = useState(initialValues.description)
  const [visibilityType, setVisibilityType] = useState<VisibilityType>(
    initialValues.visibility_type
  )
  const [priceEuros, setPriceEuros] = useState(
    initialValues.price_cents ? (initialValues.price_cents / 100).toFixed(2) : '4.99'
  )
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    initialValues.thumbnail_preview_url
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const normalizedPriceCents = useMemo(() => {
    const num = Number(priceEuros.replace(',', '.'))
    if (!Number.isFinite(num)) return NaN
    return Math.round(num * 100)
  }, [priceEuros])

  function handleThumbnailChange(file: File | null) {
    setThumbnailFile(file)

    if (!file) {
      setThumbnailPreview(initialValues.thumbnail_preview_url)
      return
    }

    if (!allowedImageMimeTypes.has(file.type)) {
      setError('Thumbnail muss JPG, PNG oder WebP sein.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setThumbnailPreview(objectUrl)
  }

  async function uploadThumbnailIfNeeded(
    supabase: ReturnType<typeof createClient>
  ): Promise<string | null> {
    if (!thumbnailFile) {
      return initialValues.thumbnail_path
    }

    if (!allowedImageMimeTypes.has(thumbnailFile.type)) {
      throw new Error('Thumbnail muss JPG, PNG oder WebP sein.')
    }

    if (thumbnailFile.size > maxThumbnailBytes) {
      throw new Error('Thumbnail ist zu groß. Limit: 8 MB.')
    }

    const extension = thumbnailFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/thumbnails/${videoId}-${Date.now()}.${extension}`

    const { error } = await supabase.storage.from('videos').upload(path, thumbnailFile, {
      cacheControl: '3600',
      upsert: true,
      contentType: thumbnailFile.type,
    })

    if (error) {
      throw new Error(error.message)
    }

    return path
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const supabase = createClient()

      if (title.trim().length < 2 || title.trim().length > 120) {
        throw new Error('Der Titel muss zwischen 2 und 120 Zeichen lang sein.')
      }

      if (description.trim().length > 1000) {
        throw new Error('Die Beschreibung darf maximal 1000 Zeichen lang sein.')
      }

      if ((visibilityType === 'paid' || visibilityType === 'members') && !paymentsEnabled) {
        throw new Error('Bezahl- oder Mitgliederinhalte sind aktuell deaktiviert.')
      }

      if (visibilityType === 'paid') {
        if (!Number.isFinite(normalizedPriceCents) || normalizedPriceCents < 99) {
          throw new Error('Preis muss mindestens 0,99 EUR sein.')
        }
      }

      const thumbnailPath = await uploadThumbnailIfNeeded(supabase)

      const payload: VideoUpdatePayload = {
        title: title.trim(),
        description: description.trim() || null,
        thumbnail_path: thumbnailPath,
        visibility_type: visibilityType,
        payment_type: visibilityType === 'paid' ? 'paid' : 'free',
        price_cents: visibilityType === 'paid' ? normalizedPriceCents : null,
        currency: visibilityType === 'paid' ? 'EUR' : null,
      }

      const videosTable = supabase.from('videos') as any

      const { error } = await videosTable.update(payload).eq('id', videoId)

      if (error) {
        throw new Error(error.message)
      }

      setSuccess('Video erfolgreich aktualisiert.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktualisierung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-white"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm text-white/70">Titel</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-white/70">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-sm text-white/70">Inhaltstyp</span>
              <select
                value={visibilityType}
                onChange={(e) => setVisibilityType(e.target.value as VisibilityType)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              >
                <option value="public">Öffentlich kostenlos</option>
                <option value="paid" disabled={!paymentsEnabled}>
                  Einzelkauf
                </option>
                <option value="members" disabled={!paymentsEnabled}>
                  Nur für Mitglieder
                </option>
              </select>
            </label>

            {visibilityType === 'paid' ? (
              <label className="space-y-2">
                <span className="block text-sm text-white/70">Preis in EUR</span>
                <input
                  value={priceEuros}
                  onChange={(e) => setPriceEuros(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                />
              </label>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/50">
                {visibilityType === 'members'
                  ? 'Dieses Video ist nach dem Speichern nur noch für aktive Mitglieder sichtbar.'
                  : 'Dieses Video bleibt kostenlos und öffentlich sichtbar.'}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-white/70">Thumbnail</div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <div className="aspect-video">
              {thumbnailPreview ? (
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail Vorschau"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/35">
                  Kein Thumbnail
                </div>
              )}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs text-white/45">
              Neues Thumbnail hochladen
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
              className="block w-full text-sm text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black"
            />
          </label>

          <p className="text-xs text-white/35">
            Erlaubt: JPG, PNG, WebP. Maximal 8 MB.
          </p>
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
          {loading ? 'Speichert...' : 'Änderungen speichern'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/my-videos')}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-white transition hover:bg-white/10"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}