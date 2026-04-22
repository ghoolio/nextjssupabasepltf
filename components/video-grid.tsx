import VideoCard from '@/components/video-card'

type VideoCardLike = {
  id: string
  title: string
  description: string | null
  thumbnail_url?: string | null
  payment_type?: 'free' | 'paid'
  price_cents?: number | null
  currency?: 'EUR' | 'USD' | null
  purchased?: boolean
  owned?: boolean
  creator_id?: string
  creator_name?: string | null
  creator_avatar_url?: string | null
}

export default function VideoGrid({ videos }: { videos: VideoCardLike[] }) {
  if (!videos.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/55">
        Keine Videos vorhanden.
      </div>
    )
  }

  return (
    <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}