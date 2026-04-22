import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const maxImageBytes = 5 * 1024 * 1024

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    const kind = String(formData.get('kind') || '')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Keine Datei erhalten.' }, { status: 400 })
    }

    if (kind !== 'avatar' && kind !== 'banner') {
      return NextResponse.json({ error: 'Ungültiger Upload-Typ.' }, { status: 400 })
    }

    if (!allowedImageMimeTypes.has(file.type)) {
      return NextResponse.json(
        { error: 'Erlaubt sind nur JPG, PNG oder WebP.' },
        { status: 400 }
      )
    }

    if (file.size > maxImageBytes) {
      return NextResponse.json(
        { error: 'Bild ist zu groß. Limit: 5 MB.' },
        { status: 400 }
      )
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/${kind}.${extension}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error } = await supabaseAdmin.storage
      .from('profile-assets')
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ path })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Upload fehlgeschlagen.',
      },
      { status: 500 }
    )
  }
}