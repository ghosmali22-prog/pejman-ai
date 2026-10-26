/** MP4 H.264 videos already this small (and ≤ 1080p) are uploaded untouched. */
const SKIP_BELOW_BYTES = 12 * 1024 * 1024
const MAX_SIDE = 1920

/**
 * Re-encodes any video (MOV, HEVC, WebM, MKV, …) in the browser before upload into MP4 H.264,
 * which plays in every browser: at most 1080p, high quality, with the index at the start of
 * the file so the site can start playing it right away.
 * Uses the device's hardware encoder (WebCodecs), so it is quick even on phones. Falls back
 * to the original file if the browser can't do it or the result isn't smaller.
 * The library is loaded only when a video is picked.
 */
export async function compressVideo(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  try {
    const mb = await import('mediabunny')
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
    const track = await input.getPrimaryVideoTrack()
    if (!track) return file
    const { displayWidth: w, displayHeight: h } = track
    const big = Math.max(w, h) > MAX_SIDE
    const playsEverywhere = track.codec === 'avc' && file.type === 'video/mp4'
    if (playsEverywhere && !big && file.size <= SKIP_BELOW_BYTES) return file

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new mb.BufferTarget(),
    })
    const conversion = await mb.Conversion.init({
      input,
      output,
      video: {
        ...(big ? (w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE }) : {}),
        codec: 'avc',
        quality: mb.QUALITY_HIGH,
        forceTranscode: true,
      },
      audio: { codec: 'aac', quality: mb.QUALITY_HIGH },
    })
    if (!conversion.isValid) return file
    conversion.onProgress = (p) => onProgress?.(p)
    await conversion.execute()
    const buffer = output.target.buffer
    // Keep an already-compatible original if re-encoding didn't make it smaller.
    if (!buffer || (playsEverywhere && buffer.byteLength >= file.size)) return file
    return new File([buffer], file.name.replace(/\.\w+$/, '') + '.mp4', { type: 'video/mp4' })
  } catch (err) {
    console.warn('Video compression skipped:', err)
    return file
  }
}
