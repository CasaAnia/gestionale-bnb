// Filtro per ambito (estratto da SpeseTracker.load(), Fase 1 — identico).
// Puro e testabile: da tutte le tabelle tiene solo i gruppi dell'ambito
// scelto e, di conseguenza, le sue categorie, regole e spese.
import type { Ambito, Group, Category, Rule, Fx } from './types.ts'

export function filtraPerAmbito(
  ambito: Ambito, groups: Group[], cats: Category[], rules: Rule[], expenses: Fx[],
) {
  const myGroups = groups.filter(x => (x.ambito || 'personale') === ambito)
  const myIds = new Set(myGroups.map(x => x.id))
  return {
    groups: myGroups,
    cats: cats.filter(x => myIds.has(x.group_id)),
    rules: rules.filter(x => x.group_id != null && myIds.has(x.group_id)),
    // Spese dell'ambito: gruppo appartenente a questo ambito. Nel personale
    // anche quelle senza gruppo (inserimenti veloci lasciati vuoti).
    expenses: expenses.filter(x => myIds.has(x.group_id || '') || (ambito === 'personale' && !x.group_id)),
  }
}
