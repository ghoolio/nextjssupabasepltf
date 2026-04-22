import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const allowedVideoMimeTypes = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

const maxImageBytes = 10 * 1024 * 1024
const maxVideoBytes = 150 * 1024 * 1024

type VisibilityType = 'public' | 'followers' | 'members'
type MediaType = 'image' | 'video'

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
    const caption = String(formData.get('caption') || '')
    const visibilityType = String(formData.get('visibilityType') || 'public') as VisibilityType

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Keine Datei erhalten.' }, { status: 400 })
    }

    if (!['public', 'followers', 'members'].includes(visibilityType)) {
      return NextResponse.json({ error: 'Ungültige Sichtbarkeit.' }, { status: 400 })
    }

    if (caption.length > 280) {
      return NextResponse.json({ error: 'Caption ist zu lang.' }, { status: 400 })
    }

    let mediaType: MediaType | null = null

    if (allowedImageMimeTypes.has(file.type)) {
      mediaType = 'image'
      if (file.size > maxImageBytes) {
        return NextResponse.json({ error: 'Bild ist zu groß. Limit: 10 MB.' }, { status: 400 })
      }
    } else if (allowedVideoMimeTypes.has(file.type)) {
      mediaType = 'video'
      if (file.size > maxVideoBytes) {
        return NextResponse.json({ error: 'Video ist zu groß. Limit: 150 MB.' }, { status: 400 })
      }
    }

    if (!mediaType) {
      return NextResponse.json(
        { error: 'Erlaubt sind JPG, PNG, WebP, MP4, WebM oder MOV.' },
        { status: 400 }
      )
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || (mediaType === 'image' ? 'jpg' : 'mp4')

    const { data: insertedRows, error: insertError } = await supabaseAdmin
      .from('creator_stories')
      .insert({
        creator_id: user.id,
        media_type: mediaType,
        file_path: 'pending',
        thumbnail_path: null,
        caption: caption.trim() || null,
        visibility_type: visibilityType,
      })
      .select('id')
      .limit(1)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const storyId = insertedRows?.[0]?.id as string | undefined

    if (!storyId) {
      return NextResponse.json({ error: 'Story konnte nicht angelegt werden.' }, { status: 500 })
    }

    const filePath = `${user.id}/stories/${storyId}/story.${extension}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('stories')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      await supabaseAdmin.from('creator_stories').delete().eq('id', storyId)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('creator_stories')
      .update({
        file_path: filePath,
      })
      .eq('id', storyId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      storyId,
      filePath,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Story konnte nicht veröffentlicht werden.',
      },
      { status: 500 }
    )
  }
}