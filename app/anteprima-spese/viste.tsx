'use client'
// Le viste dell'anteprima (Fase 3A): Panoramica (Casa Mia / Casa Ania),
// Movimenti col pannello filtri, Documenti, Revisione, Analisi.
// Tutto sintetico, nessuna chiamata di rete.
import type { ReactNode } from 'react'
import {
  ShoppingBasket, UtensilsCrossed, Home, Shirt, Car, GraduationCap, Coffee,
  Sparkles, BedDouble, Search, SlidersHorizontal, Camera, Layers, TriangleAlert,
  CircleCheck, CircleAlert, ChevronRight, Ban, RotateCcw, Plus, ArrowLeft,
  CalendarClock, FileText, Receipt, Landmark, Ellipsis,
} from 'lucide-react'
import type { Tema } from './tema'
import { MIA, ANIA, MOVIMENTI, DOCUMENTI, REVISIONE, eur, type Movimento } from './dati'

const ICONE: Record<string, typeof Coffee> = {
  'Spesa alimentare': ShoppingBasket, 'Mangiare fuori': UtensilsCrossed,
  'Casa e consumabili': Home, 'Abbigliamento': Shirt, 'Auto e trasporti': Car,
  'Scuola e formazione': GraduationCap, 'Colazioni e bevande': Coffee,
  'Pulizia e detergenti': Sparkles, 'Biancheria': BedDouble,
}
const IconaCat = ({ nome, t }: { nome: string; t: Tema }) => {
  const I = ICONE[nome] || Receipt
  return (
    <span className="grid place-items-center w-9 h-9 shrink-0"
      style={{ background: t.velo, color: t.verde, borderRadius: t.id === 'calda' ? '999px' : '0.6rem' }}>
      <I size={17} strokeWidth={2.2} />
    </span>
  )
}

// ---------- mattoni comuni ----------
export const Card = ({ t, children, className = '', tinta }: { t: Tema; children: ReactNode; className?: string; tinta?: string }) => (
  <div className={className}
    style={{ background: tinta || t.carta, borderRadius: t.r, boxShadow: t.ombra, border: t.bordoCarta }}>
    {children}
  </div>
)
export const Etichetta = ({ t, children }: { t: Tema; children: ReactNode }) => (
  <p className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: t.sub }}>{children}</p>
)
const Barra = ({ t, quota, colore }: { t: Tema; quota: number; colore: string }) => (
  <div className="h-1.5 w-full overflow-hidden" style={{ background: t.velo, borderRadius: 99 }}>
    <div className="h-full" style={{ width: `${Math.min(100, quota)}%`, background: colore, borderRadius: 99 }} />
  </div>
)
export const Chip = ({ t, attivo, children, tono = 'verde' }: { t: Tema; attivo?: boolean; children: ReactNode; tono?: 'verde' | 'neutro' }) => (
  <span className="inline-flex items-center gap-1 min-h-8 px-3 text-[13px] font-semibold"
    style={attivo
      ? { background: tono === 'verde' ? t.verde : t.inchiostro, color: '#fff', borderRadius: t.rPill }
      : { background: t.carta, color: t.inchiostro, border: `1px solid ${t.bordo}`, borderRadius: t.rPill }}>
    {children}
  </span>
)

// ---------- PANORAMICA — CASA MIA ----------
export function PanoramicaMia({ t, apriRevisione }: { t: Tema; apriRevisione: () => void }) {
  const restanti = MIA.budget.map(b => b.tetto - b.speso)
  return (
    <div className="flex flex-col gap-3">
      <Card t={t} className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <Etichetta t={t}>Speso ad {MIA.mese.toLowerCase()}</Etichetta>
          <span className="text-[12px] font-bold px-2 py-0.5"
            style={{ background: t.verdeTenue, color: t.verde, borderRadius: t.rPill }}>
            {MIA.confronto}% su luglio
          </span>
        </div>
        <p className={`${t.display} text-[34px] leading-none`} style={{ color: t.inchiostro }}>{eur(MIA.speso)}</p>
        <div className="mt-3 -mx-4 px-4 pt-3" style={{ borderTop: `1px solid ${t.bordo}` }}>
          <button onClick={apriRevisione} className="w-full min-h-11 flex items-center gap-2.5 text-left">
            <span className="grid place-items-center w-8 h-8 shrink-0" style={{ background: t.gialloTenue, color: t.giallo, borderRadius: 99 }}>
              <TriangleAlert size={16} />
            </span>
            <span className="flex-1 text-[14px] font-semibold" style={{ color: t.inchiostro }}>
              {MIA.daControllare.n} movimenti da controllare
              <span className="block text-[12px] font-normal" style={{ color: t.sub }}>{eur(MIA.daControllare.tot)} in attesa della tua conferma</span>
            </span>
            <ChevronRight size={18} style={{ color: t.sub }} />
          </button>
        </div>
      </Card>

      <Card t={t} className="px-4 py-4">
        <div className="flex items-center justify-between">
          <Etichetta t={t}>Budget di agosto</Etichetta>
          <span className="text-[12px] font-semibold" style={{ color: t.verde }}>{eur(restanti.reduce((a, b) => a + b, 0))} ancora liberi</span>
        </div>
        <div className="flex flex-col gap-3">
          {MIA.budget.map(b => {
            const quota = b.speso / b.tetto * 100
            const colore = quota >= 90 ? t.terracotta : t.verde
            return (
              <div key={b.nome}>
                <div className="flex justify-between text-[13.5px] mb-1">
                  <span className="font-medium" style={{ color: t.inchiostro }}>{b.nome}</span>
                  <span style={{ color: t.sub }}><b style={{ color: colore }}>{eur(b.speso)}</b> di {eur(b.tetto)}</span>
                </div>
                <Barra t={t} quota={quota} colore={colore} />
              </div>
            )
          })}
        </div>
      </Card>

      <Card t={t} className="px-4 py-3.5" tinta={t.id === 'calda' ? t.oroTenue : undefined}>
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-8 h-8 shrink-0" style={{ background: t.carta, color: t.oro, borderRadius: 99 }}>
            <Coffee size={16} />
          </span>
          <p className="text-[13.5px] leading-snug" style={{ color: t.inchiostro }}>
            <b>{MIA.ripetute.frase}</b> — {eur(MIA.ripetute.tot)} quasi senza accorgertene
            <span className="block text-[12px]" style={{ color: t.sub }}>{MIA.ripetute.esempio}</span>
          </p>
        </div>
      </Card>

      <Card t={t} className="px-4 py-4">
        <Etichetta t={t}>Dove va la spesa</Etichetta>
        <div className="flex flex-col gap-2.5">
          {MIA.categorie.map(c => (
            <button key={c.nome} className="flex items-center gap-3 min-h-10 text-left">
              <IconaCat nome={c.nome} t={t} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-medium" style={{ color: t.inchiostro }}>{c.nome}</span>
                <Barra t={t} quota={c.tot / MIA.categorie[0].tot * 100} colore={t.salvia} />
              </span>
              <span className={`${t.display} text-[15px]`} style={{ color: t.inchiostro }}>{eur(c.tot)}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card t={t} className="px-4 py-3.5">
        <div className="flex items-center justify-between">
          <Etichetta t={t}>Le spese di Teo</Etichetta>
          <span className={`${t.display} text-[17px]`} style={{ color: t.terracotta }}>{eur(MIA.teo.tot)}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {MIA.teo.voci.map(([n, v]) => (
            <span key={n} className="text-[12px] px-2.5 py-1 font-medium"
              style={{ background: t.velo, color: t.inchiostro, borderRadius: t.rPill }}>{n} · {eur(v)}</span>
          ))}
        </div>
      </Card>

      <Card t={t} className="px-4 py-3">
        <Etichetta t={t}>Ultime attività</Etichetta>
        {MOVIMENTI.filter(m => m.contesto === 'mia').slice(0, 4).map((m, i, a) => (
          <RigaMovimento key={m.id} m={m} t={t} ultimo={i === a.length - 1} />
        ))}
      </Card>
    </div>
  )
}

// ---------- PANORAMICA — CASA ANIA ----------
export function PanoramicaAnia({ t }: { t: Tema }) {
  return (
    <div className="flex flex-col gap-3">
      <Card t={t} className="px-4 pt-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Etichetta t={t}>Speso ad agosto</Etichetta>
            <p className={`${t.display} text-[26px] leading-none`} style={{ color: t.inchiostro }}>{eur(ANIA.speso)}</p>
            <p className="text-[12px] mt-1" style={{ color: t.sub }}>denaro uscito davvero</p>
          </div>
          <div className="pl-3" style={{ borderLeft: `1px solid ${t.bordo}` }}>
            <Etichetta t={t}>Impegnato / da pagare</Etichetta>
            <p className={`${t.display} text-[26px] leading-none`} style={{ color: t.terracotta }}>{eur(ANIA.impegnato.tot)}</p>
            <p className="text-[12px] mt-1" style={{ color: t.sub }}>{ANIA.impegnato.n} fatture approvate</p>
          </div>
        </div>
      </Card>

      <Card t={t} className="px-4 py-4">
        <Etichetta t={t}>Prossime scadenze</Etichetta>
        <div className="flex flex-col gap-1">
          {ANIA.scadenze.map((s, i) => (
            <button key={s.fornitore} className="flex items-center gap-3 min-h-11 text-left"
              style={i > 0 ? { borderTop: `1px solid ${t.bordo}` } : undefined}>
              <span className="grid place-items-center w-9 h-9 shrink-0"
                style={{ background: s.giorni <= 10 ? t.terraTenue : t.velo, color: s.giorni <= 10 ? t.terracotta : t.verde, borderRadius: t.id === 'calda' ? '999px' : '0.6rem' }}>
                <CalendarClock size={17} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold truncate" style={{ color: t.inchiostro }}>{s.fornitore}</span>
                <span className="block text-[12px]" style={{ color: t.sub }}>scade il {s.scade} · tra {s.giorni} giorni</span>
              </span>
              <span className={`${t.display} text-[15px]`} style={{ color: t.inchiostro }}>{eur(s.importo)}</span>
            </button>
          ))}
        </div>
        <button className="mt-2 w-full min-h-10 text-[13px] font-bold flex items-center justify-center gap-1.5"
          style={{ background: t.gialloTenue, color: t.giallo, borderRadius: t.rPill }}>
          <FileText size={15} /> {ANIA.fattureDaControllare} fattura da controllare
        </button>
      </Card>

      <Card t={t} className="px-4 py-4">
        <Etichetta t={t}>Come stai pagando</Etichetta>
        <div className="flex h-2 overflow-hidden mb-2" style={{ borderRadius: 99 }}>
          {ANIA.metodi.map((m, i) => (
            <div key={m.nome} style={{ width: `${m.quota}%`, background: [t.verde, t.salvia, t.oro][i] }} />
          ))}
        </div>
        <div className="flex gap-3 flex-wrap">
          {ANIA.metodi.map((m, i) => (
            <span key={m.nome} className="flex items-center gap-1.5 text-[12.5px]" style={{ color: t.sub }}>
              <span className="w-2 h-2 rounded-full" style={{ background: [t.verde, t.salvia, t.oro][i] }} />
              {m.nome} <b style={{ color: t.inchiostro }}>{m.quota}%</b>
            </span>
          ))}
        </div>
      </Card>

      <Card t={t} className="px-4 py-3">
        <Etichetta t={t}>Ultimi movimenti</Etichetta>
        {MOVIMENTI.filter(m => m.contesto === 'ania').map((m, i, a) => (
          <RigaMovimento key={m.id} m={m} t={t} ultimo={i === a.length - 1} />
        ))}
      </Card>
    </div>
  )
}

// ---------- MOVIMENTI ----------
function RigaMovimento({ m, t, ultimo }: { m: Movimento; t: Tema; ultimo?: boolean }) {
  return (
    <button className="w-full flex items-center gap-3 min-h-12 py-2 text-left"
      style={ultimo ? undefined : { borderBottom: `1px solid ${t.bordo}` }}>
      <IconaCat nome={m.categoria} t={t} />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold truncate" style={{ color: t.inchiostro }}>{m.titolo}</span>
          {m.daControllare && (
            <span className="text-[10.5px] font-bold px-1.5 py-px shrink-0"
              style={{ background: t.gialloTenue, color: t.giallo, borderRadius: t.rPill }}>da controllare</span>
          )}
        </span>
        <span className="block text-[12px] truncate" style={{ color: t.sub }}>
          {[m.negozio, m.giorno, m.metodo].filter(Boolean).join(' · ')}
        </span>
        {m.sorelle && (
          <span className="flex gap-1 mt-1">
            {m.sorelle.map(s => (
              <span key={s.nome} className="text-[10.5px] font-semibold px-1.5 py-px"
                style={{ background: s.nome === 'Casa Ania' ? t.terraTenue : t.verdeTenue, color: s.nome === 'Casa Ania' ? t.terracotta : t.verde, borderRadius: t.rPill }}>
                {s.nome} {eur(s.importo)}
              </span>
            ))}
          </span>
        )}
        {m.camera && (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-px mt-1"
            style={{ background: t.velo, color: t.verde, borderRadius: t.rPill }}>
            <BedDouble size={11} /> {m.camera}
          </span>
        )}
      </span>
      <span className={`${t.display} text-[15px] shrink-0`} style={{ color: t.inchiostro }}>{eur(m.importo)}</span>
    </button>
  )
}

export function Movimenti({ t, filtriAperti, setFiltriAperti }: { t: Tema; filtriAperti: boolean; setFiltriAperti: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 min-h-11 px-3.5"
          style={{ background: t.carta, borderRadius: t.rPill, border: t.bordoCarta, boxShadow: t.ombra }}>
          <Search size={16} style={{ color: t.sub }} />
          <input placeholder="Cerca un movimento, un negozio…" className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: t.inchiostro }} />
        </label>
        <button onClick={() => setFiltriAperti(true)} aria-label="Filtri"
          className="grid place-items-center w-11 h-11 shrink-0"
          style={{ background: t.verde, color: '#fff', borderRadius: t.rPill }}>
          <SlidersHorizontal size={17} />
        </button>
      </div>

      {/* solo i filtri ATTIVI, come pastiglie rimovibili */}
      <div className="flex gap-1.5 flex-wrap">
        <Chip t={t} attivo>Agosto <span className="opacity-70 ml-0.5">✕</span></Chip>
        <Chip t={t} attivo tono="neutro">Da controllare <span className="opacity-70 ml-0.5">✕</span></Chip>
      </div>

      <Card t={t} className="px-4 py-1.5">
        {MOVIMENTI.map((m, i) => <RigaMovimento key={m.id} m={m} t={t} ultimo={i === MOVIMENTI.length - 1} />)}
      </Card>
      <p className="text-center text-[12px]" style={{ color: t.sub }}>42 movimenti ad agosto · tocca una riga per il dettaglio</p>

      {filtriAperti && <PannelloFiltri t={t} chiudi={() => setFiltriAperti(false)} />}
    </div>
  )
}

function SezioneFiltro({ t, nome, voci, attivo }: { t: Tema; nome: string; voci: string[]; attivo?: string }) {
  return (
    <div className="mb-4">
      <Etichetta t={t}>{nome}</Etichetta>
      <div className="flex gap-1.5 flex-wrap">
        {voci.map(v => <Chip key={v} t={t} attivo={v === attivo}>{v}</Chip>)}
      </div>
    </div>
  )
}

function PannelloFiltri({ t, chiudi }: { t: Tema; chiudi: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-label="Filtri">
      <button className="absolute inset-0" style={{ background: 'rgba(20,25,20,.45)' }} onClick={chiudi} aria-label="Chiudi" />
      <div className="relative max-h-[82%] overflow-y-auto px-5 pt-3 pb-6"
        style={{ background: t.fondo, borderRadius: `${t.r} ${t.r} 0 0` }}>
        <div className="mx-auto w-10 h-1 rounded-full mb-4" style={{ background: t.bordo }} />
        <div className="flex items-center justify-between mb-4">
          <p className={`${t.display} text-[19px]`} style={{ color: t.inchiostro }}>Filtri</p>
          <button className="text-[13px] font-bold min-h-11 px-2" style={{ color: t.terracotta }}>Azzera</button>
        </div>
        <SezioneFiltro t={t} nome="Periodo" voci={['Agosto', 'Luglio', 'Anno', 'Dal–al…']} attivo="Agosto" />
        <SezioneFiltro t={t} nome="Di chi" voci={['Tutti', 'Casa', 'Ania', 'Teo', 'A + M']} attivo="Tutti" />
        <SezioneFiltro t={t} nome="Categoria" voci={['Tutte', 'Spesa alimentare', 'Mangiare fuori', 'Scuola', 'Altro…']} attivo="Tutte" />
        <SezioneFiltro t={t} nome="Pagamento" voci={['Tutti', 'Contanti', 'Carta', 'Bonifico']} attivo="Tutti" />
        <SezioneFiltro t={t} nome="Camera (Casa Ania)" voci={['Tutte', 'Amelia', 'Allegra', 'Ambra', 'Lena']} attivo="Tutte" />
        <SezioneFiltro t={t} nome="Stato" voci={['Tutti', 'Da controllare', 'Da pagare', 'Confermati']} attivo="Da controllare" />
        <button onClick={chiudi} className="w-full min-h-12 text-[15px] font-bold text-white mt-1"
          style={{ background: t.verde, borderRadius: t.rPill }}>
          Mostra 3 movimenti
        </button>
      </div>
    </div>
  )
}

// ---------- DOCUMENTI ----------
function Indicatore({ t, icona: I, testo, tono }: { t: Tema; icona: typeof Camera; testo: string; tono?: 'giallo' | 'rosso' }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-px"
      style={{
        background: tono === 'rosso' ? t.terraTenue : tono === 'giallo' ? t.gialloTenue : t.velo,
        color: tono === 'rosso' ? t.rosso : tono === 'giallo' ? t.giallo : t.sub, borderRadius: t.rPill,
      }}>
      <I size={11} /> {testo}
    </span>
  )
}
function Blocco({ t, titolo, n, children }: { t: Tema; titolo: string; n: number; children?: ReactNode }) {
  return (
    <Card t={t} className="px-4 py-3.5">
      <div className="flex items-center justify-between mb-1">
        <Etichetta t={t}>{titolo}</Etichetta>
        <span className="text-[12px] font-bold" style={{ color: t.sub }}>{n}</span>
      </div>
      {children}
    </Card>
  )
}

export function Documenti({ t, apriRevisione }: { t: Tema; apriRevisione: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Blocco t={t} titolo="Da elaborare" n={DOCUMENTI.daElaborare.length}>
        {DOCUMENTI.daElaborare.map((d, i) => (
          <div key={d.id} className="flex items-center gap-3 min-h-11" style={i > 0 ? { borderTop: `1px solid ${t.bordo}` } : undefined}>
            <span className="grid place-items-center w-9 h-9" style={{ background: t.velo, color: t.sub, borderRadius: '0.6rem' }}><Camera size={16} /></span>
            <span className="flex-1 text-[14px]" style={{ color: t.inchiostro }}>{d.titolo}</span>
            <span className="text-[12px]" style={{ color: t.sub }}>in coda</span>
          </div>
        ))}
      </Blocco>
      <Blocco t={t} titolo="Da controllare" n={DOCUMENTI.daControllare.length}>
        {DOCUMENTI.daControllare.map(d => (
          <button key={d.id} onClick={apriRevisione} className="w-full flex items-center gap-3 min-h-12 text-left">
            <span className="grid place-items-center w-9 h-9" style={{ background: t.gialloTenue, color: t.giallo, borderRadius: '0.6rem' }}><Receipt size={16} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold" style={{ color: t.inchiostro }}>{d.titolo} · {eur(d.importo)}</span>
              <span className="flex gap-1 mt-0.5">
                <Indicatore t={t} icona={Camera} testo="1 foto" />
                <Indicatore t={t} icona={TriangleAlert} testo={`${d.dubbi} campo dubbio`} tono="giallo" />
              </span>
            </span>
            <ChevronRight size={18} style={{ color: t.sub }} />
          </button>
        ))}
      </Blocco>
      <Blocco t={t} titolo="Da pagare" n={DOCUMENTI.daPagare.length}>
        {DOCUMENTI.daPagare.map((d, i) => (
          <div key={d.id} className="flex items-center gap-3 min-h-12" style={i > 0 ? { borderTop: `1px solid ${t.bordo}` } : undefined}>
            <span className="grid place-items-center w-9 h-9" style={{ background: t.terraTenue, color: t.terracotta, borderRadius: '0.6rem' }}><Landmark size={16} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold truncate" style={{ color: t.inchiostro }}>{d.titolo}</span>
              <span className="flex gap-1 mt-0.5">
                <Indicatore t={t} icona={CalendarClock} testo={`scade ${d.scade}`} tono="rosso" />
                {d.pagine && <Indicatore t={t} icona={Layers} testo={`${d.pagine} pagine`} />}
              </span>
            </span>
            <span className={`${t.display} text-[15px]`} style={{ color: t.terracotta }}>{eur(d.importo)}</span>
          </div>
        ))}
      </Blocco>
      <Blocco t={t} titolo="Confermati" n={DOCUMENTI.confermati}>
        <p className="text-[13px] min-h-9 flex items-center" style={{ color: t.sub }}>Tutto in ordine ad agosto · tocca per l&apos;archivio</p>
      </Blocco>
      <Blocco t={t} titolo="Errori" n={DOCUMENTI.errori.length}>
        {DOCUMENTI.errori.map(d => (
          <div key={d.id} className="flex items-center gap-3 min-h-11">
            <span className="grid place-items-center w-9 h-9" style={{ background: t.terraTenue, color: t.rosso, borderRadius: '0.6rem' }}><CircleAlert size={16} /></span>
            <span className="flex-1 text-[13.5px]" style={{ color: t.inchiostro }}>{d.titolo}
              <span className="block text-[12px]" style={{ color: t.sub }}>{d.motivo}</span>
            </span>
            <button className="text-[12.5px] font-bold min-h-11 px-2" style={{ color: t.verde }}>Riprova</button>
          </div>
        ))}
      </Blocco>
    </div>
  )
}

// ---------- REVISIONE ----------
export function Revisione({ t, chiudi }: { t: Tema; chiudi: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ background: t.fondo }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5"
        style={{ background: t.fondo, borderBottom: `1px solid ${t.bordo}` }}>
        <button onClick={chiudi} aria-label="Indietro" className="grid place-items-center w-11 h-11" style={{ color: t.inchiostro }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-[15px] font-bold leading-tight" style={{ color: t.inchiostro }}>Controlla lo scontrino</p>
          <p className="text-[12px]" style={{ color: t.sub }}>{REVISIONE.negozio} · {REVISIONE.data}</p>
        </div>
        <span className={`${t.display} text-[19px] pr-2`} style={{ color: t.inchiostro }}>{eur(REVISIONE.totale)}</span>
      </div>

      <div className="px-4 py-3 flex flex-col gap-3 pb-32 max-w-md mx-auto">
        {/* foto */}
        <div className="relative h-40 overflow-hidden grid place-items-center"
          style={{ borderRadius: t.r, background: `linear-gradient(160deg, ${t.velo}, ${t.bordo})` }}>
          <span className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: t.sub }}>
            <Camera size={16} /> foto dello scontrino · tocca per ingrandire
          </span>
          <span className="absolute bottom-2 right-3 text-[11px] font-bold px-2 py-0.5"
            style={{ background: 'rgba(255,255,255,.85)', color: t.inchiostro, borderRadius: 99 }}>pagina 1 di 1</span>
        </div>

        {/* controlli con esito e spiegazione */}
        <Card t={t} className="px-4 py-3.5">
          <Etichetta t={t}>Controlli</Etichetta>
          <div className="flex flex-col gap-2.5">
            {REVISIONE.controlli.map(c => (
              <div key={c.testo} className="flex gap-2.5 items-start">
                {c.esito === 'ok'
                  ? <CircleCheck size={18} className="shrink-0 mt-px" style={{ color: t.verde }} />
                  : <TriangleAlert size={18} className="shrink-0 mt-px" style={{ color: t.giallo }} />}
                <p className="text-[13.5px] leading-snug" style={{ color: t.inchiostro }}>
                  <b>{c.testo}</b>
                  <span className="block text-[12px]" style={{ color: t.sub }}>{c.dettaglio}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* righe una per una */}
        <Card t={t} className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <Etichetta t={t}>Righe · una per una</Etichetta>
            <span className="text-[12px] font-semibold" style={{ color: t.sub }}>somma {eur(REVISIONE.totale)}</span>
          </div>
          <div className="flex flex-col">
            {REVISIONE.righe.map((r, i) => (
              <div key={r.id} className="py-2.5" style={i > 0 ? { borderTop: `1px solid ${t.bordo}` } : undefined}>
                <div className="flex items-center gap-2">
                  <span className={`flex-1 text-[14px] font-medium ${r.esclusa ? 'line-through opacity-45' : ''}`}
                    style={{ color: t.inchiostro }}>
                    {r.nome}
                    {r.dubbio && !r.esclusa && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-px align-middle"
                        style={{ background: t.gialloTenue, color: t.giallo, borderRadius: t.rPill }}>
                        <TriangleAlert size={10} /> {r.dubbio}
                      </span>
                    )}
                  </span>
                  <span className={`${t.display} text-[14.5px] ${r.esclusa ? 'line-through opacity-45' : ''}`}
                    style={{ color: t.inchiostro }}>{eur(r.importo)}</span>
                  <button aria-label={r.esclusa ? 'Ripristina riga' : 'Escludi riga'}
                    className="grid place-items-center w-9 h-9 -mr-1.5"
                    style={{ color: r.esclusa ? t.verde : t.sub }}>
                    {r.esclusa ? <RotateCcw size={15} /> : <Ban size={15} />}
                  </button>
                </div>
                {!r.esclusa && (
                  <div className="flex gap-1 mt-1.5">
                    {['Casa Mia', 'Casa Ania'].map(d => (
                      <span key={d} className="text-[11px] font-bold px-2 py-0.5"
                        style={r.dest === d
                          ? { background: d === 'Casa Ania' ? t.terracotta : t.verde, color: '#fff', borderRadius: t.rPill }
                          : { background: t.velo, color: t.sub, borderRadius: t.rPill }}>{d}</span>
                    ))}
                    <span className="text-[11px] ml-auto self-center" style={{ color: t.sub }}>destinatario</span>
                  </div>
                )}
                {r.esclusa && <p className="text-[11.5px] mt-0.5" style={{ color: t.sub }}>esclusa: letta due volte — resta nell&apos;archivio</p>}
              </div>
            ))}
          </div>
          <button className="w-full min-h-11 mt-1 text-[13.5px] font-bold flex items-center justify-center gap-1.5"
            style={{ color: t.verde, border: `1.5px dashed ${t.salvia}`, borderRadius: t.rPill }}>
            <Plus size={15} /> Aggiungi una riga
          </button>
        </Card>
      </div>

      {/* conferma fissa in basso */}
      <div className="fixed bottom-0 inset-x-0 z-[60] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)]"
        style={{ background: t.fondo, borderTop: `1px solid ${t.bordo}` }}>
        <div className="max-w-md mx-auto">
          <button className="w-full min-h-12 text-[15px] font-bold text-white flex items-center justify-center gap-2"
            style={{ background: t.verde, borderRadius: t.rPill, boxShadow: t.ombra }}>
            <CircleCheck size={18} /> Conferma · 2 spese per {eur(REVISIONE.totale)}
          </button>
          <p className="text-center text-[11.5px] mt-1.5" style={{ color: t.sub }}>quadratura esatta al centesimo · una spesa Casa Mia e una Casa Ania</p>
        </div>
      </div>
    </div>
  )
}

// ---------- ANALISI (assaggio) ----------
export function Analisi({ t }: { t: Tema }) {
  return (
    <div className="flex flex-col gap-3">
      <Card t={t} className="px-4 py-4">
        <Etichetta t={t}>In questa sezione (fase 6)</Etichetta>
        <p className="text-[13.5px] leading-relaxed" style={{ color: t.inchiostro }}>
          Calendario, Racconto e Domanda si trasferiscono qui, insieme alle analisi
          nuove: abitudini e piccole spese ripetute, l&apos;anno scolastico di Teo,
          i costi per camera di Casa Ania.
        </p>
      </Card>
      <Card t={t} className="px-4 py-4">
        <div className="flex items-center justify-between">
          <Etichetta t={t}>Assaggio · conto del caffè</Etichetta>
          <Ellipsis size={16} style={{ color: t.sub }} />
        </div>
        <p className="text-[13.5px]" style={{ color: t.inchiostro }}>
          <b>19 caffè fuori casa</b> ad agosto — {eur(24.7)}
        </p>
        <div className="flex items-end gap-1 h-12 mt-2">
          {[3, 5, 2, 6, 4, 7, 3, 5, 6, 4, 2, 5].map((v, i) => (
            <div key={i} className="flex-1" style={{ height: `${v * 12}%`, background: i === 5 ? t.terracotta : t.salvia, borderRadius: 3 }} />
          ))}
        </div>
      </Card>
    </div>
  )
}
