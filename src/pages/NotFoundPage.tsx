import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="flex min-h-[80svh] flex-col items-center justify-center px-6 pt-24 text-center">
      <p className="display text-[34vw] text-lime md:text-[240px]">404</p>
      <p className="heading mt-4 text-3xl md:text-4xl">This page doesn't exist.</p>
      <Link
        to="/"
        className="mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-lime px-7 font-semibold text-ink"
      >
        Back to home <ArrowRight className="size-5" />
      </Link>
    </main>
  )
}
