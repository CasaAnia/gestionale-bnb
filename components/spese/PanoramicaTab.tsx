'use client'
// Panoramica del nuovo guscio (Fase 3.1) — due letture diverse per Casa Mia
// (budget, controlli, abitudini, Teo) e Casa Ania (speso vs impegnato,
// scadenze, metodi), con gli stessi mattoni e lo stesso linguaggio visivo.
import { TriangleAlert, ChevronRight, Coffee, CalendarClock, FileText } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Card, Etichetta, Barra, IconaCategoria, Pastiglia } from './mattoni'
import { eurVista as eur, nelMese, perContesto, type PanoramicaMiaVista, type PanoramicaAniaVista, type MovimentoVista } from '@/lib/spese/vista'
import { RigaMovimento } from './MovimentiTab'
import { Vuoto } from './StatiDati'

export function PanoramicaMia({ dati, movimenti, apriDaControllare }: {
  dati: PanoramicaMiaVista
  movimenti: MovimentoVista[]
  apriDaControllare: () => void
}) {
  const recenti = perContesto(movimenti, 'mia').slice(0, 4)
  return (
    <div className="flex flex-col gap-3">
      <Card className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <Etichetta>Speso {nelMese(dati.mese)}</Etichetta>
          {dati.confrontoPct !== null && (
            <span className="text-[12px] font-bold px-2 py-0.5"
              style={{ background: t.verdeTenue, color: t.verde, borderRadius: t.rPill }}>
              {dati.confrontoPct > 0 ? '+' : ''}{dati.confrontoPct}% sul mese scorso
            </span>
          )}
        </div>
        <p className={`${DISPLAY} text-[34px] leading-none`} style={{ color: t.inchiostro }}>{eur(dati.speso)}</p>
        {dati.daControllare.n > 0 && (
          <div className="mt-3 -mx-4 px-4 pt-3" style={{ borderTop: `1px solid ${t.bordo}` }}>
            <button onClick={apriDaControllare} className="w-full min-h-11 flex items-center gap-2.5 text-left">
              <span className="grid place-items-center w-8 h-8 shrink-0" style={{ background: t.gialloTenue, color: t.giallo, borderRadius: 99 }}>
                <TriangleAlert size={16} />
              </span>
              <span className="flex-1 text-[14px] font-semibold" style={{ color: t.inchiostro }}>
                {dati.daControllare.n} {dati.daControllare.n === 1 ? 'movimento' : 'movimenti'} da controllare
                <span className="block text-[12px] font-normal" style={{ color: t.sub }}>
                  {eur(dati.daControllare.tot)} in attesa della tua conferma
                </span>
              </span>
              <ChevronRight size={18} style={{ color: t.sub }} />
            </button>
          </div>
        )}
      </Card>

      {dati.budget.length > 0 && (
        <Card className="px-4 py-4">
          <div className="flex items-center justify-between">
            <Etichetta>Budget di {dati.mese.toLowerCase()}</Etichetta>
            <span className="text-[12px] font-semibold" style={{ color: t.verde }}>
              {eur(dati.budget.reduce((s, b) => s + Math.max(0, b.tetto - b.speso), 0))} ancora liberi
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {dati.budget.map(b => {
              const quota = b.tetto > 0 ? b.speso / b.tetto * 100 : 0
              const colore = quota >= 90 ? t.terracotta : t.verde
              return (
                <div key={b.nome}>
                  <div className="flex justify-between text-[13.5px] mb-1">
                    <span className="font-medium" style={{ color: t.inchiostro }}>{b.nome}</span>
                    <span style={{ color: t.sub }}><b style={{ color: colore }}>{eur(b.speso)}</b> di {eur(b.tetto)}</span>
                  </div>
                  <Barra quota={quota} colore={colore} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {dati.ripetute && (
        <Card className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 shrink-0" style={{ background: t.oroTenue, color: t.oro, borderRadius: 99 }}>
              <Coffee size={16} />
            </span>
            <p className="text-[13.5px] leading-snug" style={{ color: t.inchiostro }}>
              <b>{dati.ripetute.frase}</b> — {eur(dati.ripetute.tot)} complessivi
              <span className="block text-[12px]" style={{ color: t.sub }}>per esempio: {dati.ripetute.esempio}</span>
            </p>
          </div>
        </Card>
      )}

      {dati.categorie.length > 0 ? (
        <Card className="px-4 py-4">
          <Etichetta>Dove va la spesa</Etichetta>
          <div className="flex flex-col gap-2.5">
            {dati.categorie.slice(0, 6).map(c => (
              <div key={c.nome} className="flex items-center gap-3 min-h-10">
                <IconaCategoria nome={c.nome} tenue />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-medium" style={{ color: t.inchiostro }}>{c.nome}</span>
                  <Barra quota={c.tot / dati.categorie[0].tot * 100} colore={t.salvia} />
                </span>
                <span className={`${DISPLAY} text-[15px]`} style={{ color: t.inchiostro }}>{eur(c.tot)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card><Vuoto titolo="Ancora nessuna spesa questo mese" dettaglio="Le categorie compariranno qui appena registri qualcosa." /></Card>
      )}

      {dati.teo && (
        <Card className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <Etichetta>Le spese di Teo</Etichetta>
            <span className={`${DISPLAY} text-[17px]`} style={{ color: t.terracotta }}>{eur(dati.teo.tot)}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {dati.teo.voci.map(([n, v]) => (
              <span key={n} className="text-[12px] px-2.5 py-1 font-medium"
                style={{ background: t.velo, color: t.inchiostro, borderRadius: t.rPill }}>{n} · {eur(v)}</span>
            ))}
          </div>
        </Card>
      )}

      {recenti.length > 0 && (
        <Card className="px-4 py-3">
          <Etichetta>Ultime attività</Etichetta>
          {recenti.map((m, i, a) => (
            <RigaMovimento key={m.id} m={m} contesto="mia" ultimo={i === a.length - 1} />
          ))}
        </Card>
      )}
    </div>
  )
}

export function PanoramicaAnia({ dati, movimenti }: {
  dati: PanoramicaAniaVista
  movimenti: MovimentoVista[]
}) {
  const recenti = perContesto(movimenti, 'ania').slice(0, 4)
  return (
    <div className="flex flex-col gap-3">
      <Card className="px-4 pt-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Etichetta>Speso {nelMese(dati.mese)}</Etichetta>
            <p className={`${DISPLAY} text-[26px] leading-none`} style={{ color: t.inchiostro }}>{eur(dati.speso)}</p>
            <p className="text-[12px] mt-1" style={{ color: t.sub }}>denaro uscito davvero</p>
          </div>
          <div className="pl-3" style={{ borderLeft: `1px solid ${t.bordo}` }}>
            <Etichetta>Impegnato / da pagare</Etichetta>
            <p className={`${DISPLAY} text-[26px] leading-none`} style={{ color: t.terracotta }}>{eur(dati.impegnato.tot)}</p>
            <p className="text-[12px] mt-1" style={{ color: t.sub }}>
              {dati.impegnato.n} {dati.impegnato.n === 1 ? 'fattura approvata' : 'fatture approvate'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="px-4 py-4">
        <Etichetta>Prossime scadenze</Etichetta>
        {dati.scadenze.length === 0 ? (
          <p className="text-[13px] min-h-9 flex items-center" style={{ color: t.sub }}>Nessuna fattura in scadenza: tutto pagato.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {dati.scadenze.map((s, i) => (
              <div key={s.fornitore} className="flex items-center gap-3 min-h-11"
                style={i > 0 ? { borderTop: `1px solid ${t.bordo}` } : undefined}>
                <span className="grid place-items-center w-9 h-9 shrink-0"
                  style={{ background: s.giorni <= 10 ? t.terraTenue : t.velo, color: s.giorni <= 10 ? t.terracotta : t.verde, borderRadius: t.rIcona }}>
                  <CalendarClock size={17} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold truncate" style={{ color: t.inchiostro }}>{s.fornitore}</span>
                  <span className="block text-[12px]" style={{ color: t.sub }}>scade il {s.scade} · tra {s.giorni} giorni</span>
                </span>
                <span className={`${DISPLAY} text-[15px]`} style={{ color: t.inchiostro }}>{eur(s.importo)}</span>
              </div>
            ))}
          </div>
        )}
        {dati.fattureDaControllare > 0 && (
          <div className="mt-2 w-full min-h-10 text-[13px] font-bold flex items-center justify-center gap-1.5"
            style={{ background: t.gialloTenue, color: t.giallo, borderRadius: t.rPill }}>
            <FileText size={15} /> {dati.fattureDaControllare} {dati.fattureDaControllare === 1 ? 'fattura da controllare' : 'fatture da controllare'}
          </div>
        )}
      </Card>

      <Card className="px-4 py-4">
        <Etichetta>Come stai pagando</Etichetta>
        <div className="flex h-2 overflow-hidden mb-2" style={{ borderRadius: 99 }}>
          {dati.metodi.map((m, i) => (
            <div key={m.nome} style={{ width: `${m.quota}%`, background: [t.verde, t.salvia, t.oro][i % 3] }} />
          ))}
        </div>
        <div className="flex gap-3 flex-wrap">
          {dati.metodi.map((m, i) => (
            <span key={m.nome} className="flex items-center gap-1.5 text-[12.5px]" style={{ color: t.sub }}>
              <span className="w-2 h-2 rounded-full" style={{ background: [t.verde, t.salvia, t.oro][i % 3] }} />
              {m.nome} <b style={{ color: t.inchiostro }}>{m.quota}%</b>
            </span>
          ))}
        </div>
        <p className="text-[11.5px] mt-2" style={{ color: t.sub }}>
          <Pastiglia testo="promemoria" tono="verde" /> per il B&amp;B serve sempre il metodo di pagamento
        </p>
      </Card>

      {recenti.length > 0 && (
        <Card className="px-4 py-3">
          <Etichetta>Ultimi movimenti</Etichetta>
          {recenti.map((m, i, a) => (
            <RigaMovimento key={m.id} m={m} contesto="ania" ultimo={i === a.length - 1} />
          ))}
        </Card>
      )}
    </div>
  )
}
