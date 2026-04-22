import Link from 'next/link'
import { logout } from '@/lib/actions'

export default function Navbar({ userEmail }: { userEmail?: string }) {
  return (
    <header className="border-b border-white/10 bg-neutral-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          VideoHub Secure
        </Link>
        <nav className="flex items-center gap-4 text-sm text-white/80">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/upload">Upload</Link>
          {userEmail ? <span className="hidden text-white/40 sm:inline">{userEmail}</span> : null}
          <form action={logout}>
            <button className="rounded-xl border border-white/10 px-3 py-2">Logout</button>
          </form>
        </nav>
      </div>
    </header>
  )
}
