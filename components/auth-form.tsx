'use client'

import { useState, useTransition } from 'react'

export default function AuthForm({
  type,
  action,
}: {
  type: 'login' | 'register'
  action: (formData: FormData) => Promise<{ error?: string } | void>
}) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError('')
        const formData = new FormData(e.currentTarget)
        startTransition(async () => {
          const result = await action(formData)
          if (result?.error) setError(result.error)
        })
      }}
    >
      {type === 'register' && (
        <input
          name="username"
          placeholder="Benutzername"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
          maxLength={40}
        />
      )}
      <input
        name="email"
        type="email"
        placeholder="E-Mail"
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
        required
        autoComplete="email"
      />
      <input
        name="password"
        type="password"
        placeholder="Passwort"
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
        required
        minLength={8}
        autoComplete={type === 'login' ? 'current-password' : 'new-password'}
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-white px-4 py-3 font-medium text-black disabled:opacity-60"
      >
        {pending ? 'Lädt...' : type === 'login' ? 'Einloggen' : 'Registrieren'}
      </button>
    </form>
  )
}
