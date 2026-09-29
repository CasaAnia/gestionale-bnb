# Menu del Mac «Maison» — checklist

Riferimento: `docs/design/menu-mac-riferimento.html`, colonna «M2» (approvata da Ania il 29/09/2026).
Si tocca solo la `<nav>` «hidden lg:flex» di `components/BottomNav.tsx` (più il margine in `app/layout.tsx`).
La barra bassa del telefono e `MobileTopBar` non cambiano.

Stato: ☐ da fare · ✅ fatta · ✖ non fatta (con motivo)

## Colonna (`.mz .sb`)
1. ☐ Larghezza 200 px (era 192); `lg:pl-48` di `app/layout.tsx` → `lg:pl-[200px]`
2. ☐ Fondo #F6F2EA
3. ☐ Filo destro 1 px #E1D9CB
4. ☐ Fissa a sinistra, tutta altezza
5. ☐ Padding in alto 34 px, niente padding in basso
6. ☐ Carattere Jost (var(--m-ui)) per tutto tranne il marchio
7. ☐ Niente più cerchio «CA»

## Marchio (`.wm`)
8. ☐ Blocco con padding 0 24px 30px, allineato a sinistra
9. ☐ «Casa Ania»: Cormorant Garamond (var(--m-disp)) 26 px, peso 400, interlinea 1, spaziatura .01em, colore ink #241F1A
10. ☐ «ROZZANO»: 9,5 px maiuscoletto, spaziatura .24em, ottone #A8894F, 6 px sotto il nome

## Gruppi (`.g`)
11. ☐ Etichette 9 px maiuscolo, spaziatura .24em, ottone #A8894F, padding 18px 24px 6px
12. ☐ Nessuna etichetta sopra «Home»
13. ☐ «OGNI GIORNO» sopra Calendario, Richieste, Arrivi, Pulizie
14. ☐ «ARCHIVIO» sopra Prenotazioni, Clienti, Spese B&B, Spese Famiglia, Statistiche, Impostazioni
15. ☐ Ordine: Home · Calendario · Richieste · Arrivi · Pulizie · Prenotazioni · Clienti · Spese B&B · Spese Famiglia · Statistiche · Impostazioni
16. ☐ Nessun distanziatore in più fra i gruppi (solo il padding delle etichette)

## Voci (`.mz a`)
17. ☐ Riga flex, padding 8px 24px, spazio icona–testo 10 px
18. ☐ Testo Jost 13,5 px #6E6558, senza sottolineatura
19. ☐ Icona a filo 15 px: lucide di oggi (House, CalendarDays, Inbox, DoorOpen, Sparkles, ClipboardList, Users, Banknote, Wallet, ChartColumn, Settings), strokeWidth 1.3, colore ink, opacità .7
20. ☐ Voce attiva: testo ink #241F1A, icona a opacità piena
21. ☐ Voce attiva: filo ottone 2 px a sinistra, da 8 px sotto il bordo alto a 8 px sopra il bordo basso
22. ☐ Hover: testo ink
23. ☐ Regola di «attiva» come oggi (pathname uguale, o inizia con l'indirizzo tranne «/»)
24. ☐ Link e indirizzi invariati; `visible(item.href)` resta

## Bollini (`.bd`)
25. ☐ Stessi conteggi: webCount sul Calendario, richiesteCount e inAttesaRisposta (blu) sulle Richieste; «!» se la lettura fallisce; nascosti a 0
26. ☐ Pillola alta 16 px (interlinea 16 px), padding 0 6px, angoli tondi pieni
27. ☐ Testo 10 px avorio #F6F2EA
28. ☐ Fondo ottone #A8894F; blu #7D9DB0 per «in attesa di risposta»
29. ☐ Allineata a destra nella riga (margin-left:auto sul primo), 6 px fra i due bollini
30. ☐ Solo sul Mac: il puntino d'ottone del telefono non cambia

## Piede (`.ft`)
31. ☐ Versione in fondo, a 18 px dal bordo basso, padding 0 24px
32. ☐ 10 px, grigio #8A8072, spaziatura .08em
33. ☐ Testo «v. {NEXT_PUBLIC_BUILD_TAG}» (nel riferimento c'è una data d'esempio: si usa la sigla della versione come chiesto)
34. ☐ Tolta la versione dalla legenda del Calendario dal Mac (un posto solo)

## Novità e confini
35. ☐ «Nuova» non c'è più nel menu del Mac (il riferimento M2 non ha né voce né bottone «+ Nuova»)
36. ☐ I link «Nuova prenotazione» del telefono e delle pagine restano (striscia della Home, Calendario/Arrivi al tocco, «+ Nuova» in Prenotazioni)
37. ☐ Barra bassa del telefono, foglio «Menu» e MobileTopBar invariati
38. ☐ Il resto della pagina non cambia (solo lo spostamento di 8 px del contenuto per la colonna più larga)
