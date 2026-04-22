type SignedUrlResult = {
  data: {
    signedUrl: string
  } | null
}

type StorageCapableClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (path: string, expiresIn: number) => Promise<SignedUrlResult>
    }
  }
}

export async function attachSignedThumbnailUrls<
  T extends { thumbnail_path?: string | null }
>(
  supabase: StorageCapableClient,
  items: T[]
): Promise<(T & { thumbnail_url: string | null })[]> {
  const withUrls = await Promise.all(
    items.map(async (item) => {
      if (!item.thumbnail_path) {
        return {
          ...item,
          thumbnail_url: null,
        }
      }

      const { data } = await supabase.storage
        .from('videos')
        .createSignedUrl(item.thumbnail_path, 60 * 60)

      return {
        ...item,
        thumbnail_url: data?.signedUrl ?? null,
      }
    })
  )

  return withUrls
}