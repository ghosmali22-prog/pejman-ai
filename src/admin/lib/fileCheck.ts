/**
 * Recognises a file by its first bytes ("magic bytes"), not by its name or the type the phone
 * claims. Used before every upload, so a renamed HTML or script file can never be stored as a
 * video or image. Storage also enforces size and type limits on the server (see migrations).
 */
export type Sniffed = 'mp4' | 'mov' | 'webm' | 'mkv' | 'avi' | 'ogg' | 'ts' | 'flv' | 'jpeg' | 'png' | 'webp' | 'gif' | 'avif' | 'heic'

export async function sniff(file: Blob): Promise<Sniffed | null> {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to))
  if (b.length < 12) return null
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    if (brand === 'qt  ') return 'mov'
    if (/^avi[fs]$/.test(brand)) return 'avif'
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return 'heic'
    return 'mp4' // isom, mp41, mp42, M4V, 3gp…
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return ascii(0, 32).includes('webm') ? 'webm' : 'mkv'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'AVI ') return 'avi'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (ascii(0, 4) === 'OggS') return 'ogg'
  if (ascii(0, 3) === 'FLV') return 'flv'
  if (b[0] === 0x47 && (b.length < 189 || b[188] === 0x47)) return 'ts'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png'
  if (ascii(0, 4) === 'GIF8') return 'gif'
  return null
}

const VIDEOS: Sniffed[] = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'ogg', 'ts', 'flv']
const IMAGES: Sniffed[] = ['jpeg', 'png', 'webp', 'gif', 'avif', 'heic']

export const isVideoFile = async (f: Blob) => VIDEOS.includes((await sniff(f)) as Sniffed)
export const isImageFile = async (f: Blob) => IMAGES.includes((await sniff(f)) as Sniffed)

/** MIME type to store for a checked video (never the type the browser guessed from the name). */
export function videoMime(kind: Sniffed | null): string {
  switch (kind) {
    case 'webm':
      return 'video/webm'
    case 'mov':
      return 'video/quicktime'
    case 'mkv':
      return 'video/x-matroska'
    case 'avi':
      return 'video/x-msvideo'
    case 'ogg':
      return 'video/ogg'
    case 'ts':
      return 'video/mp2t'
    case 'flv':
      return 'video/x-flv'
    default:
      return 'video/mp4'
  }
}
