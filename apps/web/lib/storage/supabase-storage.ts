import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}
if (!supabaseKey) {
  throw new Error('Neither SUPABASE_SERVICE_ROLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set');
}

// Server-side Supabase client
// Prefers service role key for unrestricted access, falls back to anon key
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Upload image from URL to Supabase Storage
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  storagePath: string,
  bucket: string = 'thumbnails'
): Promise<{ publicUrl: string; path: string }> {
  try {
    // Download image from DALL-E temporary URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return { publicUrl, path: storagePath };
  } catch (error: any) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImage(
  storagePath: string,
  bucket: string = 'thumbnails'
): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}
