type Props = {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}

export default function PageShell({ title, description, children, action }: Props) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-white md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-white/55">{description}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </section>

      {children}
    </main>
  )
}