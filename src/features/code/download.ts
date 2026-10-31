import type { CodeFile } from '../../types'

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name, rel: 'noopener' })
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Downloads one file as is, or every file of a project as <slug>.zip (zipped in the browser). */
export async function downloadFiles(files: CodeFile[], slug: string) {
  if (files.length === 1) {
    save(new Blob([files[0].content], { type: 'text/plain;charset=utf-8' }), files[0].name.split('/').pop()!)
    return
  }
  const { zipSync, strToU8 } = await import('fflate')
  const zipped = zipSync(Object.fromEntries(files.map((f) => [`${slug}/${f.name}`, strToU8(f.content)])), { level: 6 })
  save(new Blob([zipped as BlobPart], { type: 'application/zip' }), `${slug}.zip`)
}
