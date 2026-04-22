import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type FollowRow = {
  id: string
  creator_id: string
  follower_id: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const creatorId = String(body.creatorId || '')

    if (!creatorId) {
      return NextResponse.json({ error: 'Creator fehlt.' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
    }

    if (user.id === creatorId) {
      return NextResponse.json(
        { error: 'Du kannst dir nicht selbst folgen.' },
        { status: 400 }
      )
    }

    const { data: followRows } = await supabase
      .from('creator_follows')
      .select('id, creator_id, follower_id')
      .eq('creator_id', creatorId)
      .eq('follower_id', user.id)
      .returns<FollowRow[]>()

    const existing = followRows?.[0] ?? null

    if (existing) {
      const followsTable = supabase.from('creator_follows') as any
      const { error } = await followsTable.delete().eq('id', existing.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ following: false })
    }

    const followsTable = supabase.from('creator_follows') as any
    const { error } = await followsTable.insert({
      creator_id: creatorId,
      follower_id: user.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ following: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Follow-Status konnte nicht geändert werden.',
      },
      { status: 500 }
    )
  }
}