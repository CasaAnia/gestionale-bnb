import Link from 'next/link'

export default function BackLink({ href, label = 'Indietro' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-block text-green-dark font-bold hover:text-green-mid transition-colors whitespace-nowrap rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid"
    >
      <span aria-hidden="true">←</span> {label}
    </Link>
  )
}
