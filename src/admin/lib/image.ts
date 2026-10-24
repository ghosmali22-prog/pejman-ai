export interface CompressedImage {
  blob: Blob
  width: number
  height: number
  ext: 'webp' | 'jpg'
  previewUrl: string
}

/**
 * Resizes a photo (max 1600px on the long side) and converts it to WebP in the browser,
 * so uploads from the phone camera roll stay small. Falls back to JPEG on browsers
 * that cannot encode WebP.
 */
export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadViaImg(file))
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height)
  if ('close' in bitmap) bitmap.close()

  const toBlob = (type: string, q: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q))
  let blob = await toBlob('image/webp', quality)
  let ext: CompressedImage['ext'] = 'webp'
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob('image/jpeg', 0.86)
    ext = 'jpg'
  }
  if (!blob) throw new Error('Could not encode image')
  return { blob, width, height, ext, previewUrl: URL.createObjectURL(blob) }
}

function loadViaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export const formatBytes = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
