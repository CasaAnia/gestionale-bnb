import BackLink from './BackLink'

// Barra dell'indietro: resta sempre visibile mentre si scorre la pagina, appena sotto
// la barra col titolo di sezione (alta 48px su mobile; su desktop quella barra non c'è
// e questa si ferma in cima). Così non serve più risalire tutta la pagina per tornare
// indietro.
// Va usata dentro un contenitore con padding `p-4`: i margini negativi allargano lo
// sfondo fino ai bordi dello schermo, altrimenti scorrendo si vedrebbe il contenuto
// passare nei 16px laterali.
export default function BackBar({ href, onClick, label }: { href?: string; onClick?: () => void; label?: string }) {
  return (
    <div className="sticky top-12 lg:top-0 z-30 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-2 bg-cream/95 backdrop-blur-sm">
      <BackLink href={href} onClick={onClick} label={label} />
    </div>
  )
}
