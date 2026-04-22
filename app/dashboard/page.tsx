import Link from 'next/link'
import Navbar from '@/components/navbar'
import VideoGrid from '@/components/video-grid'
import { createClient } from '@/lib/supabase-server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: videos } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <main>
      <Navbar userEmail={user?.email} />
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="mt-2 text-white/60">Deine Videos, kostenlos oder bezahlt.</p>
          </div>
          <Link href="/upload" className="rounded-2xl bg-white px-5 py-3 font-medium text-black">Neues Video</Link>
        </div>
        <VideoGrid videos={videos || []} />
      </section>
    </main>
  )
}
