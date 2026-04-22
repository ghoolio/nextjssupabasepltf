import AppSidebar from '@/components/app-sidebar'
import MobileBottomNav from '@/components/mobile-bottom-nav'

export default function AppFrame({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <div className="flex min-h-[calc(100vh-56px)]">
        <AppSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <MobileBottomNav />
    </>
  )
}