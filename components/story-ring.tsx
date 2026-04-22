'use client'

import Link from 'next/link'

export default function StoryRing({
  href,
  imageUrl,
  label,
  size = 'md',
  seen = false,
  showLabel = true,
}: {
  href: string
  imageUrl: string | null
  label: string
  size?: 'sm' | 'md' | 'lg'
  seen?: boolean
  showLabel?: boolean
}) {
  const sizeClasses =
    size === 'sm'
      ? 'h-12 w-12'
      : size === 'lg'
        ? 'h-20 w-20'
        : 'h-16 w-16'

  const textClasses = size === 'sm' ? 'text-[11px]' : 'text-xs'

  const ringClasses = seen
    ? 'bg-white/15 p-[2px]'
    : 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px]'

  return (
    <Link href={href} className="group flex flex-col items-center gap-2">
      <div
        className={`rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition ${ringClasses}`}
      >
        <div className={`overflow-hidden rounded-full bg-neutral-950 ${sizeClasses}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={label}
              className={`h-full w-full rounded-full object-cover transition duration-300 group-hover:scale-[1.03] ${
                seen ? 'opacity-75' : ''
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-sm text-white/60">
              {(label?.[0] || 'S').toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {showLabel ? (
        <div
          className={`max-w-[84px] truncate text-center ${textClasses} ${
            seen ? 'text-white/45' : 'text-white/70'
          }`}
        >
          {label}
        </div>
      ) : null}
    </Link>
  )
}