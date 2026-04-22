import AuthForm from '@/components/auth-form'
import { register } from '@/lib/actions'

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="mb-6 text-2xl font-semibold">Registrieren</h1>
        <AuthForm type="register" action={register} />
      </div>
    </main>
  )
}
