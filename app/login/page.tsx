import AuthForm from '@/components/auth-form'
import { login } from '@/lib/actions'

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="mb-6 text-2xl font-semibold">Login</h1>
        <AuthForm type="login" action={login} />
      </div>
    </main>
  )
}
