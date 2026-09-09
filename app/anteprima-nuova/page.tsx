// ANTEPRIMA NUOVA PRENOTAZIONE — prototipo da guardare, non da usare.
//
// Pubblicata su richiesta di Ania (09/09/2026) per poterla aprire dal
// telefono: sta dietro al login del gestionale come tutto il resto, non è
// collegata da nessun menù e i dati sono TUTTI sintetici (app/anteprima-nuova
// /dati.ts). Nessuna query a Supabase, nessuna scrittura: il salvataggio
// mostra soltanto quello che salverebbe. Non tocca /nuova né /prenotazioni.
import AnteprimaNuova from './AnteprimaNuova'

export const metadata = { title: 'Anteprima nuova prenotazione' }

export default function PaginaAnteprimaNuova() {
  return <AnteprimaNuova />
}
