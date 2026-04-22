'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type HighlightItem = {
  id: string
  media_type: 'image' | 'video'
  signed_url: string | null
  caption: string | null
  visibility_type: 'public' | 'followers' | 'members'
  published_at: string
}

const IMAGE_DURATION_MS = 5000

export default function HighlightViewer({
  highlightId,
  highlightTitle,
  creatorId,
  creatorName,
  creatorAvatarUrl,
  stories,
  initialIndex,
}: {
  highlightId: string
  highlightTitle: string
  creatorId: string
  creatorName: string
  creatorAvatarUrl: string | null
  stories: HighlightItem[]
  initialIndex: number
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const currentStory = stories[currentIndex] ?? null

  const currentLabel = useMemo(() => {
    if (!currentStory) return ''
    if (currentStory.visibility_type === 'public') return 'Öffentlich'
    if (currentStory.visibility_type === 'followers') return 'Nur Follower'
    return 'Nur Mitglieder'
  }, [currentStory])

  useEffect(() => {
    if (!currentStory) return
    const nextUrl = `/highlights/${highlightId}?story=${currentStory.id}`
    window.history.replaceState({}, '', nextUrl)
  }, [highlightId, currentStory?.id])

  useEffect(() => {
    setProgress(0)
    setIsPaused(false)
    const video = videoRef.current
    if (video) video.currentTime = 0
  }, [currentIndex])

  useEffect(() => {
    if (!currentStory || currentStory.media_type !== 'image' || isPaused) return

    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const next = Math.min(elapsed / IMAGE_DURATION_MS, 1)
      setProgress(next)

      if (next >= 1) {
        window.clearInterval(interval)
        goNext()
      }
    }, 50)

    return () => window.clearInterval(interval)
  }, [currentStory?.id, currentStory?.media_type, isPaused])

  function goNext() {
    setProgress(0)
    setCurrentIndex((prev) => (prev >= stories.length - 1 ? prev : prev + 1))
  }

  function goPrev() {
    setProgress(0)
    setCurrentIndex((prev) => (prev <= 0 ? prev : prev - 1))
  }

  function handleVideoTimeUpdate() {
    const video = videoRef.current
    if (!video || !video.duration) return
    setProgress(video.currentTime / video.duration)
  }

  function handleVideoEnded() {
    if (currentIndex < stories.length - 1) goNext()
  }

  if (!currentStory) return null

  const isFirst = currentIndex === 0
  const isLast = currentIndex === stories.length - 1

  return (
    <section className="mx-auto flex h-[100dvh] w-full max-w-[430px] items-center justify-center overflow-hidden">
      <div className="relative flex h-full w-full max-h-[96dvh] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl">
        <div className="z-20 shrink-0 px-4 pb-3 pt-4">
          <div className="mb-4 flex gap-1.5">
            {stories.map((story, index) => {
              const value = index < currentIndex ? 1 : index === currentIndex ? progress : 0
              return (
                <div
                  key={story.id}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
                >
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-100"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-white/10">
                {creatorAvatarUrl ? (
                  <img
                    src={creatorAvatarUrl}
                    alt={creatorName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                    {(creatorName?.[0] || 'C').toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">
                  {highlightTitle}
                </div>
                <div className="truncate text-xs text-white/45">
                  {creatorName}
                </div>
              </div>
            </div>

            <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/65 backdrop-blur">
              {currentLabel}
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-black px-3 pb-3">
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
            {currentStory.media_type === 'image' ? (
              currentStory.signed_url ? (
                <img
                  src={currentStory.signed_url}
                  alt={currentStory.caption || 'Highlight'}
                  className="h-full w-full object-cover"
                  onMouseDown={() => setIsPaused(true)}
                  onMouseUp={() => setIsPaused(false)}
                  onMouseLeave={() => setIsPaused(false)}
                  onTouchStart={() => setIsPaused(true)}
                  onTouchEnd={() => setIsPaused(false)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/40">
                  Bild nicht verfügbar
                </div>
              )
            ) : currentStory.signed_url ? (
              <video
                ref={videoRef}
                src={currentStory.signed_url}
                autoPlay
                playsInline
                controls
                className="h-full w-full object-cover"
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleVideoEnded}
                onPlay={() => setIsPaused(false)}
                onPause={() => setIsPaused(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/40">
                Video nicht verfügbar
              </div>
            )}

            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="absolute inset-y-0 left-0 z-10 w-1/3 disabled:cursor-default"
              aria-label="Vorheriges Highlight-Item"
            />

            <button
              type="button"
              onClick={goNext}
              disabled={isLast}
              className="absolute inset-y-0 right-0 z-10 w-1/3 disabled:cursor-default"
              aria-label="Nächstes Highlight-Item"
            />

            <div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center">
              <div className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 backdrop-blur">
                {isFirst ? '—' : '‹'}
              </div>
            </div>

            <div className="pointer-events-none absolute inset-y-0 right-3 z-10 flex items-center">
              <div className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 backdrop-blur">
                {isLast ? '—' : '›'}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-black px-4 py-4">
          {currentStory.caption ? (
            <p className="line-clamp-2 text-sm leading-6 text-white/80">
              {currentStory.caption}
            </p>
          ) : (
            <p className="text-sm text-white/35">Keine Caption</p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              Zurück
            </button>

            <div className="text-xs text-white/45">
              {currentIndex + 1} / {stories.length}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={isLast}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-40"
            >
              Weiter
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}