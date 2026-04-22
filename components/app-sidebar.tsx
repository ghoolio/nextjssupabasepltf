'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Startseite', icon: '⌂' },
  { href: '/explore', label: 'Explore', icon: '◌' },
  { href: '/my-following', label: 'Gefolgt', icon: '♥' },
  { href: '/my-memberships', label: 'Mitgliedschaften', icon: '♡' },
  { href: '/my-videos', label: 'Meine Videos', icon: '▣' },
  { href: '/purchases', label: 'Meine Käufe', icon: '★' },
  { href: '/upload', label: 'Upload', icon: '+' },
  { href: '/settings', label: 'Einstellungen', icon: '◉' },
]

export default function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-black/40 lg:block">
      <nav className="sticky top-[73px] p-3">
        <div className="space-y-1">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                  active
                    ? 'bg-white text-black'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="w-5 text-center text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}