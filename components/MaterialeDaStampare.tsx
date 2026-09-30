import Image from 'next/image'

const base = '/materiale-stampa/biglietti-2026-09-27'

const biglietti = [
  {
    id: 'solo-fronte',
    titolo: 'Biglietto solo fronte',
    descrizione: 'Tutte le informazioni su un lato.',
    pdf: 'Casa-Ania-biglietto-solo-fronte-STAMPA.pdf',
    immagini: [{ file: 'solo-fronte.png', label: 'Biglietto solo fronte approvato' }],
  },
  {
    id: 'fronte-retro',
    titolo: 'Biglietto fronte-retro',
    descrizione: 'Presentazione sul fronte, telefono e sito sul retro.',
    pdf: 'Casa-Ania-biglietto-fronte-retro-STAMPA.pdf',
    immagini: [
      { file: 'fronte.png', label: 'Fronte del biglietto approvato' },
      { file: 'retro.png', label: 'Retro del biglietto approvato' },
    ],
  },
]

export default function MaterialeDaStampare() {
  return (
    <section id="materiale-da-stampare" aria-labelledby="materiale-stampa-titolo" className="mt-6 scroll-mt-16 ed-riga py-5">
      <h2 id="materiale-stampa-titolo" className="font-serif text-xl text-green-dark mb-2">Materiale da stampare</h2>
      <p className="text-sm text-gray-500 mb-5">I biglietti Casa Ania approvati, pronti da scaricare e inviare alla tipografia.</p>
      <div className="grid gap-6 md:grid-cols-2">
        {biglietti.map(biglietto => (
          <article key={biglietto.id} aria-labelledby={`stampa-${biglietto.id}`} className="min-w-0">
            <h3 id={`stampa-${biglietto.id}`} className="font-semibold text-green-dark">{biglietto.titolo}</h3>
            <p className="text-xs text-gray-500 mt-1 mb-3">{biglietto.descrizione}</p>
            <div className="space-y-2 mb-3">
              {biglietto.immagini.map(immagine => (
                <a key={immagine.file} href={`${base}/${immagine.file}`} target="_blank" rel="noopener noreferrer" aria-label={`Ingrandisci: ${immagine.label}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2">
                  <Image src={`${base}/${immagine.file}`} alt={immagine.label} width={1560} height={1010} unoptimized className="w-full h-auto border border-black/10" />
                </a>
              ))}
            </div>
            <a href={`${base}/${biglietto.pdf}`} download className="inline-flex min-h-11 items-center justify-center bg-green-mid text-white rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Scarica PDF per stampa: ${biglietto.titolo}`}>
              Scarica PDF per stampa
            </a>
          </article>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">Formato 85 × 55 mm, con 3 mm di margine per il taglio. Nel PDF fronte-retro: pagina 1 fronte, pagina 2 retro.</p>
      <p className="text-xs text-gray-500 mt-1">Versioni approvate il 27 settembre 2026.</p>
    </section>
  )
}
