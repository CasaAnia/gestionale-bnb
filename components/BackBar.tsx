import BackLink from './BackLink'

// Barra dell'indietro del computer: resta visibile mentre si scorre la pagina.
// Sul telefono non c'è più — il ritorno è la freccia ‹ nella barra in alto, che
// così fa risparmiare una riga intera (classe `.indietro-barra`, vedi
// globals.css: torna a vedersi solo col telefono girato a tutto schermo, dove la
// barra in alto sparisce).
// Va usata dentro un contenitore con padding `p-4`: i margini negativi allargano lo
// sfondo fino ai bordi dello schermo, altrimenti scorrendo si vedrebbe il contenuto
// passare nei 16px laterali.
export default function BackBar({ href, onClick, label }: { href?: string; onClick?: () => void; label?: string }) {
  return (
    <div className="indietro-barra hidden lg:block sticky top-0 z-30 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-2 bg-cream/95 backdrop-blur-sm">
      <BackLink href={href} onClick={onClick} label={label} />
    </div>
  )
}
