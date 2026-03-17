/**
 * File upload validation utilities.
 * Validates both MIME type and file magic bytes (first 8 bytes)
 * to prevent malicious file uploads masquerading as valid media.
 */

export const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',  // .avi
  'video/x-matroska', // .mkv
  'video/mpeg',
]);

export const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/x-m4a',
  'audio/aac',
]);

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

// Magic bytes (file signatures) for validation
const MAGIC_BYTES: Array<{ signature: number[]; type: string }> = [
  { signature: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], type: 'video/mp4' }, // MP4
  { signature: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], type: 'video/mp4' }, // MP4
  { signature: [0x1A, 0x45, 0xDF, 0xA3], type: 'video/webm' },   // WebM/MKV
  { signature: [0xFF, 0xD8, 0xFF], type: 'image/jpeg' },          // JPEG
  { signature: [0x89, 0x50, 0x4E, 0x47], type: 'image/png' },     // PNG
  { signature: [0x47, 0x49, 0x46], type: 'image/gif' },           // GIF
  { signature: [0x52, 0x49, 0x46, 0x46], type: 'video/x-msvideo' }, // AVI/WAV (RIFF)
  { signature: [0x49, 0x44, 0x33], type: 'audio/mpeg' },          // MP3 with ID3
  { signature: [0xFF, 0xFB], type: 'audio/mpeg' },                // MP3
  { signature: [0x4F, 0x67, 0x67, 0x53], type: 'audio/ogg' },    // OGG
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
}

/**
 * Validate file type using both MIME type header and magic bytes.
 * @param file - The File/Blob to validate
 * @param allowedTypes - Set of allowed MIME types
 * @param maxSizeMb - Maximum file size in MB (default: 500MB for video)
 */
export async function validateFileUpload(
  file: File,
  allowedTypes: Set<string>,
  maxSizeMb = 500,
): Promise<FileValidationResult> {
  // Check file size
  const maxBytes = maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `File too large. Maximum size is ${maxSizeMb}MB.` };
  }

  // Check declared MIME type
  const declaredType = file.type.toLowerCase();
  if (!allowedTypes.has(declaredType)) {
    return {
      valid: false,
      error: `File type "${declaredType}" is not allowed. Allowed types: ${[...allowedTypes].join(', ')}`,
    };
  }

  // Validate magic bytes (first 8 bytes)
  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const matchedMagic = MAGIC_BYTES.find(({ signature }) =>
      signature.every((byte, i) => bytes[i] === byte)
    );

    if (matchedMagic && !allowedTypes.has(matchedMagic.type)) {
      return {
        valid: false,
        error: 'File content does not match its declared type. Upload rejected.',
        detectedType: matchedMagic.type,
      };
    }
  } catch {
    // If we can't read magic bytes, fall back to MIME type only
  }

  return { valid: true };
}

/**
 * Quick check for server-side validation using just filename and content-type header.
 */
export function validateContentType(
  contentType: string | null,
  allowedTypes: Set<string>,
): FileValidationResult {
  if (!contentType) {
    return { valid: false, error: 'Content-Type header is required.' };
  }
  // Strip parameters like "; boundary=..."
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  if (!allowedTypes.has(mimeType)) {
    return {
      valid: false,
      error: `Content-Type "${mimeType}" is not allowed.`,
    };
  }
  return { valid: true };
}
