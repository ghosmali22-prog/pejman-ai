import { useEffect, useMemo, useState } from 'react'

type Highlighter = typeof import('./highlight').highlight
let loader: Promise<Highlighter> | null = null
const loadHighlighter = () => (loader ??= import('./highlight').then((m) => m.highlight))

/**
 * Read-only code with line numbers and syntax colours. Shows plain text straight away and
 * swaps in the coloured version once highlight.js has loaded (it is fetched on first use).
 */
export function CodeViewer({ code, language, className = '' }: { code: string; language: string; className?: string }) {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  useEffect(() => {
    let alive = true
    loadHighlighter()
      .then((fn) => alive && setHighlighter(() => fn))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const html = useMemo(() => highlighter?.(code, language) ?? null, [highlighter, code, language])
  const lines = useMemo(() => code.split('\n').length, [code])

  return (
    <div
      data-lenis-prevent
      className={`code-view overflow-auto overscroll-contain rounded-2xl bg-[#0e1110] font-mono text-[12.5px] leading-[1.7] ring-1 ring-white/[0.08] md:text-[13px] ${className}`}
    >
      <div className="flex min-w-max">
        <pre
          aria-hidden="true"
          className="sticky left-0 select-none border-r border-white/[0.06] bg-[#0e1110] py-4 pl-4 pr-3 text-right text-paper/25"
        >
          {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
        </pre>
        {html !== null ? (
          // Safe: highlight.js escapes the code; it is only displayed, never run.
          <pre className="py-4 pl-4 pr-6 text-paper/85">
            <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        ) : (
          <pre className="py-4 pl-4 pr-6 text-paper/85">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
