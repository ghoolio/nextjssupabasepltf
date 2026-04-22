'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const maxImageBytes = 5 * 1024 * 1024

type ProfileUpdatePayload = {
  username: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  support_enabled: boolean
  support_cta: string | null
  membership_enabled: boolean
}

export default function EditProfileForm({
  userId,
  initialProfile,
}: {
  userId: string
  initialProfile: {
    username: string
    display_name: string
    bio: string
    avatar_url: string
    banner_url: string
    support_enabled: boolean
    support_cta: string
    membership_enabled: boolean
  }
}) {
  const router = useRouter()

  const [username, setUsername] = useState(initialProfile.username)
  const [displayName, setDisplayName] = useState(initialProfile.display_name)
  const [bio, setBio] = useState(initialProfile.bio)
  const [supportEnabled, setSupportEnabled] = useState(initialProfile.support_enabled)
  const [supportCta, setSupportCta] = useState(initialProfile.support_cta)
  const [membershipEnabled, setMembershipEnabled] = useState(initialProfile.membership_enabled)

  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function uploadViaApi(file: File | null, kind: 'avatar' | 'banner') {
    if (!file) return null

    if (!allowedImageMimeTypes.has(file.type)) {
      throw new Error('Erlaubt sind nur JPG, PNG oder WebP.')
    }

    if (file.size > maxImageBytes) {
      throw new Error('Bild ist zu groß. Limit: 5 MB.')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', kind)

    const res = await fetch('/api/profile/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Upload fehlgeschlagen.')
    }

    return String(data.path || '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const supabase = createClient()

      const avatarPath =
        (await uploadViaApi(avatarFile, 'avatar')) ||
        initialProfile.avatar_url ||
        null

      const bannerPath =
        (await uploadViaApi(bannerFile, 'banner')) ||
        initialProfile.banner_url ||
        null

      const payload: ProfileUpdatePayload = {
        username: username.trim() || null,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarPath,
        banner_url: bannerPath,
        support_enabled: supportEnabled,
        support_cta: supportCta.trim() || null,
        membership_enabled: membershipEnabled,
      }

      const profilesTable = supabase.from('profiles') as any
      const { error } = await profilesTable.update(payload).eq('id', userId)

      if (error) {
        throw new Error(error.message)
      }

      setSuccess('Profil erfolgreich gespeichert.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-white"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@username"
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
          maxLength={40}
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display Name"
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
          maxLength={80}
        />
      </div>

      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Erzähl etwas über dich, deinen Content und warum Leute bleiben sollten."
        className="min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
        maxLength={500}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-sm text-white/70">Avatar</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-white/70"
          />
        </label>

        <label className="space-y-2">
          <span className="block text-sm text-white/70">Banner</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-white/70"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <input
            type="checkbox"
            checked={supportEnabled}
            onChange={(e) => setSupportEnabled(e.target.checked)}
          />
          <span className="text-sm">Support-CTA aktivieren</span>
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <input
            type="checkbox"
            checked={membershipEnabled}
            onChange={(e) => setMembershipEnabled(e.target.checked)}
          />
          <span className="text-sm">Mitgliedschaften vorbereiten</span>
        </label>
      </div>

      <input
        value={supportCta}
        onChange={(e) => setSupportCta(e.target.value)}
        placeholder="z. B. Unterstütze mich für exklusive Inhalte"
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
        maxLength={120}
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl bg-white px-5 py-3 font-medium text-black disabled:opacity-60"
      >
        {loading ? 'Speichert...' : 'Profil speichern'}
      </button>
    </form>
  )
}