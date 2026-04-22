'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { allowedVideoMimeTypes, maxVideoBytes } from '@/lib/validation'

const allowedThumbnailMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const maxThumbnailBytes = 5 * 1024 * 1024

type VideoInsert = {
  id: string
  user_id: string
  title: string
  description: string | null
  file_path: string
  thumbnail_path: string | null
  file_size: number
  is_public: boolean
  payment_type: 'free' | 'paid'
  price_cents: number | null
  currency: 'EUR' | 'USD' | null
  visibility_type: 'public' | 'paid' | 'members'
}

export default function UploadForm({
  userId,
  paymentsEnabled,
}: {
  userId: string
  paymentsEnabled: boolean
}) {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [paymentType, setPaymentType] = useState<'free' | 'paid'>('free')
  const [visibilityType, setVisibilityType] = useState<'public' | 'paid' | 'members'>('public')
  const [priceEuros, setPriceEuros] = useState('4.99')

  const [file, setFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [autoThumbnailFile, setAutoThumbnailFile] = useState<File | null>(null)

  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null)
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeThumbnailFile = thumbnailFile || autoThumbnailFile

  const priceCents = useMemo(() => {
    const normalized = priceEuros.replace(',', '.')
    const parsed = Number(normalized)
    return Math.round(parsed * 100)
  }, [priceEuros])

  useEffect(() => {
    if (!activeThumbnailFile) {
      setThumbnailPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(activeThumbnailFile)
    setThumbnailPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [activeThumbnailFile])

  async function generateThumbnailFromVideo(videoFile: File) {
    setGeneratingThumbnail(true)

    try {
      const generated = await createThumbnailFromVideo(videoFile)
      setAutoThumbnailFile(generated)
    } catch {
      setAutoThumbnailFile(null)
    } finally {
      setGeneratingThumbnail(false)
    }
  }

  async function handleVideoChange(nextFile: File | null) {
    setFile(nextFile)
    setError('')

    if (!nextFile) {
      setAutoThumbnailFile(null)
      return
    }

    if (!allowedVideoMimeTypes.has(nextFile.type)) {
      return
    }

    if (!thumbnailFile) {
      await generateThumbnailFromVideo(nextFile)
    }
  }

  async function handleThumbnailChange(nextFile: File | null) {
    setError('')
    setThumbnailFile(nextFile)

    if (nextFile) {
      setAutoThumbnailFile(null)
    } else if (file) {
      await generateThumbnailFromVideo(file)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!file) {
      return setError('Bitte eine Videodatei wählen.')
    }

    if (!title.trim()) {
      return setError('Bitte einen Titel eingeben.')
    }

    if (!allowedVideoMimeTypes.has(file.type)) {
      return setError('Dateityp für Video nicht erlaubt.')
    }

    if (file.size > maxVideoBytes) {
      return setError('Videodatei ist zu groß. Limit: 200 MB.')
    }

    if (activeThumbnailFile) {
      if (!allowedThumbnailMimeTypes.has(activeThumbnailFile.type)) {
        return setError('Thumbnail muss JPG, PNG oder WebP sein.')
      }

      if (activeThumbnailFile.size > maxThumbnailBytes) {
        return setError('Thumbnail ist zu groß. Limit: 5 MB.')
      }
    }

    if ((visibilityType === 'paid' || visibilityType === 'members') && !paymentsEnabled) {
      return setError('Bezahl- oder Mitgliederinhalte sind aktuell deaktiviert.')
    }

    if (visibilityType === 'paid' && (priceCents < 99 || !Number.isFinite(priceCents))) {
      return setError('Preis muss mindestens 0,99 sein.')
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const videoId = crypto.randomUUID()

      const videoExt = file.name.split('.').pop()?.toLowerCase() || 'mp4'
      const filePath = `${userId}/${videoId}.${videoExt}`

      let thumbnailPath: string | null = null

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) {
        setLoading(false)
        return setError(uploadError.message)
      }

      if (activeThumbnailFile) {
        const thumbExt = activeThumbnailFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        thumbnailPath = `${userId}/thumbnails/${videoId}.${thumbExt}`

        const { error: thumbnailUploadError } = await supabase.storage
          .from('videos')
          .upload(thumbnailPath, activeThumbnailFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: activeThumbnailFile.type,
          })

        if (thumbnailUploadError) {
          await supabase.storage.from('videos').remove([filePath])
          setLoading(false)
          return setError(thumbnailUploadError.message)
        }
      }

      const payload: VideoInsert = {
        id: videoId,
        user_id: userId,
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        file_path: filePath,
        thumbnail_path: thumbnailPath,
        file_size: file.size,
        is_public: true,
        visibility_type: visibilityType,
        payment_type: paymentType,
        price_cents: paymentType === 'paid' ? priceCents : null,
        currency: paymentType === 'paid' ? 'EUR' : null,
      }

      const { error: insertError } = await supabase
        .from('videos')
        .insert([payload] as any)

      if (insertError) {
        const cleanupPaths = [filePath]
        if (thumbnailPath) cleanupPaths.push(thumbnailPath)

        await supabase.storage.from('videos').remove(cleanupPaths)
        setLoading(false)
        return setError(insertError.message)
      }

      setLoading(false)
      router.push(`/video/${videoId}`)
      router.refresh()
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titel"
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
        required
        maxLength={120}
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Beschreibung"
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
        rows={4}
        maxLength={1000}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-sm text-white/70">Inhaltstyp</span>
          <select
            value={visibilityType}
            onChange={(e) =>
              setVisibilityType(e.target.value as 'public' | 'paid' | 'members')
            }
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
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/45">
            {visibilityType === 'members'
              ? 'Dieses Video ist später nur für aktive Mitglieder sichtbar.'
              : 'Dieses Video ist öffentlich sichtbar.'}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-white/70">Videodatei</label>
        <input
          type="file"
          accept="video/mp4,video/webm,video/ogg,video/quicktime"
          onChange={(e) => handleVideoChange(e.target.files?.[0] || null)}
          className="block w-full text-sm text-white/70"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-white/70">Thumbnail (optional)</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
          className="block w-full text-sm text-white/70"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm text-white/70">Thumbnail-Vorschau</span>
          {generatingThumbnail ? (
            <span className="text-xs text-white/45">Automatisch wird ein Thumbnail erzeugt...</span>
          ) : thumbnailFile ? (
            <span className="text-xs text-white/45">Manuelles Thumbnail aktiv</span>
          ) : autoThumbnailFile ? (
            <span className="text-xs text-white/45">Automatisch aus dem Video erzeugt</span>
          ) : (
            <span className="text-xs text-white/45">Noch kein Thumbnail vorhanden</span>
          )}
        </div>

        <div className="aspect-video overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10">
          {thumbnailPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailPreviewUrl}
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

      <p className="text-xs text-white/40">
        Video: MP4, WebM, OGG, MOV bis 200 MB. Thumbnail: JPG, PNG oder WebP bis 5 MB.
        Wenn du kein Thumbnail hochlädst, wird automatisch eines aus dem Video erzeugt.
      </p>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        disabled={loading || generatingThumbnail}
        type="submit"
        className="rounded-2xl bg-white px-5 py-3 font-medium text-black disabled:opacity-60"
      >
        {loading ? 'Upload läuft...' : 'Video hochladen'}
      </button>
    </form>
  )
}

async function createThumbnailFromVideo(file: File): Promise<File> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = objectUrl

    await waitForEvent(video, 'loadeddata')

    const seekTime = Math.min(1, Math.max(0.1, video.duration || 0.1))
    video.currentTime = seekTime

    await waitForEvent(video, 'seeked')

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas-Kontext konnte nicht erzeugt werden.')
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    })

    if (!blob) {
      throw new Error('Thumbnail konnte nicht erzeugt werden.')
    }

    return new File([blob], 'auto-thumbnail.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function waitForEvent<T extends Event>(element: HTMLMediaElement, eventName: string) {
  return new Promise<T>((resolve, reject) => {
    const onSuccess = (event: Event) => {
      cleanup()
      resolve(event as T)
    }

    const onError = () => {
      cleanup()
      reject(new Error(`Fehler beim Video-Event: ${eventName}`))
    }

    const cleanup = () => {
      element.removeEventListener(eventName, onSuccess)
      element.removeEventListener('error', onError)
    }

    element.addEventListener(eventName, onSuccess, { once: true })
    element.addEventListener('error', onError, { once: true })
  })
}