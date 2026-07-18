import Link from 'next/link'

// Unico stile ufficiale del pulsante indietro: grassetto, verde scuro,
// hover verso il verde medio. py-2/-my-2 allarga l'area di tocco su
// mobile senza spostare nulla visivamente.
const CLASSES = 'inline-block text-green-dark font-bold hover:text-green-mid transition-colors whitespace-nowrap rounded-sm py-2 -my-2 pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid'

export default function BackLink({ href, onClick, label = 'Indietro' }: { href?: string; onClick?: () => void; label?: string }) {
  const content = <><span aria-hidden="true">←</span> {label}</>
  if (href) {
    return <Link href={href} className={CLASSES}>{content}</Link>
  }
  return <button type="button" onClick={onClick} className={CLASSES}>{content}</button>
}
