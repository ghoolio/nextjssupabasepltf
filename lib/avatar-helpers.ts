type PublicUrlResult = {
  data: {
    publicUrl: string
  }
}

type StorageCapableClient = {
  storage: {
    from: (bucket: string) => {
      getPublicUrl: (path: string) => PublicUrlResult
    }
  }
}

export async function attachSignedAvatarUrls<
  T extends { creator_avatar_url?: string | null }
>(
  supabase: StorageCapableClient,
  items: T[]
): Promise<(T & { creator_avatar_signed_url: string | null })[]> {
  return items.map((item) => {
    if (!item.creator_avatar_url) {
      return {
        ...item,
        creator_avatar_signed_url: null,
      }
    }

    const { data } = supabase.storage
      .from('profile-assets')
      .getPublicUrl(item.creator_avatar_url)

    return {
      ...item,
      creator_avatar_signed_url: data.publicUrl ?? null,
    }
  })
}