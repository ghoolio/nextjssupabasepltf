import Link from 'next/link'

type Props = {
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export default function EmptyState({ title, description, actionLabel, actionHref }: Props) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white">
      <h2 className="text-xl font-medium">{title}</h2>
      <p className="mt-2 max-w-xl text-sm text-white/55">{description}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}