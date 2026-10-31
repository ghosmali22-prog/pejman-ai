import {
  languageFromName,
  MAX_FILE_BYTES,
  MAX_PROJECT_BYTES,
  MAX_PROJECT_FILES,
  MAX_ZIP_BYTES,
} from '../../lib/code'
import type { CodeFile } from '../../types'

/** File types the upload button accepts. */
export const ACCEPT = '.html,.htm,.css,.scss,.js,.mjs,.jsx,.ts,.tsx,.json,.py,.md,.svg,.vue,.svelte,.txt,.zip'

/** A problem the editor shows to the user, e.g. "file too big". */
export class CodeFileError extends Error {
  kind: 'fileTooBig' | 'zipTooBig' | 'projectTooBig' | 'notText' | 'emptyZip' | 'badZip'
  constructor(kind: CodeFileError['kind']) {
    super(kind)
    this.kind = kind
  }
}

export interface ReadResult {
  files: CodeFile[]
  /** Files left out of a .zip: images, fonts, node_modules, lock files… */
  skipped: number
  /** The uploaded file name, used to suggest a title. */
  sourceName: string
}

const decoder = () => new TextDecoder('utf-8', { fatal: true })
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.next|dist|build|\.vercel|\.cache|__MACOSX)\//
const SKIP_FILE = /(^|\/)(\.DS_Store|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb)$/

/** Reads an uploaded code file or .zip project into a list of text files. */
export async function readCodeUpload(file: File): Promise<ReadResult> {
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') return readZip(file)
  if (file.size > MAX_FILE_BYTES) throw new CodeFileError('fileTooBig')
  let content: string
  try {
    content = decoder().decode(await file.arrayBuffer())
  } catch {
    throw new CodeFileError('notText')
  }
  return {
    files: [{ name: file.name, language: languageFromName(file.name) || 'text', content: normalize(content) }],
    skipped: 0,
    sourceName: file.name,
  }
}

async function readZip(file: File): Promise<ReadResult> {
  if (file.size > MAX_ZIP_BYTES) throw new CodeFileError('zipTooBig')
  const { unzipSync } = await import('fflate')
  let entries: Record<string, Uint8Array>
  let all = 0
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      // Only unpack code files; images, fonts, node_modules… are counted as skipped.
      filter: (f) => {
        if (!f.name.endsWith('/')) all++
        return !SKIP_DIR.test(f.name) && !SKIP_FILE.test(f.name) && !!languageFromName(f.name) && f.originalSize <= MAX_FILE_BYTES
      },
    })
  } catch {
    throw new CodeFileError('badZip')
  }

  const files: CodeFile[] = []
  let total = 0
  for (const [name, bytes] of Object.entries(entries)) {
    if (name.endsWith('/')) continue
    let content: string
    try {
      content = decoder().decode(bytes)
    } catch {
      continue // binary file with a code-like name
    }
    total += bytes.length
    if (total > MAX_PROJECT_BYTES || files.length >= MAX_PROJECT_FILES) throw new CodeFileError('projectTooBig')
    files.push({ name, language: languageFromName(name), content: normalize(content) })
  }
  if (!files.length) throw new CodeFileError('emptyZip')

  // "my-project/index.html" → "index.html" when every file shares one top folder.
  const roots = new Set(files.map((f) => (f.name.includes('/') ? f.name.split('/')[0] : '')))
  if (roots.size === 1 && !roots.has('')) {
    const root = [...roots][0] + '/'
    files.forEach((f) => (f.name = f.name.slice(root.length)))
  }
  files.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  return { files, skipped: Math.max(0, all - files.length), sourceName: file.name }
}

/** index.html first, then other HTML, then the rest in name order. */
const rank = (f: CodeFile) => (/^index\.html?$/i.test(f.name) ? 0 : f.language === 'html' ? 1 : f.name.includes('/') ? 3 : 2)

const normalize = (s: string) => s.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
