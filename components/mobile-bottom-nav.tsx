'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/', label: 'Start', icon: '⌂' },
  { href: '/explore', label: 'Explore', icon: '◌' },
  { href: '/my-following', label: 'Folgt', icon: '♥' },
  { href: '/upload', label: 'Upload', icon: '+' },
  { href: '/settings', label: 'Settings', icon: '◉' },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-3 text-xs transition ${
                active ? 'text-white' : 'text-white/45'
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}