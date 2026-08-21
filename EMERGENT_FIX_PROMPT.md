# BOMBER TRAINER — BUG ACTIVITATS / SINCRONITZACIÓ

Aquesta versió és una còpia del projecte actual perquè Emergent investigui i solucioni el problema de les activitats sincronitzades.

## PROBLEMA REAL

A la pantalla **ACTIVITATS**, després de sincronitzar, apareixen moltes activitats amb dades incorrectes o buides.

Exemples que NO són reals:
- activitats del 2026-08-20 amb **4:00.0** o **5:00.0** de durada.
- moltes activitats mostren `—` a FC mitjana i FC màxima encara que les dades originals existeixen o l'activitat real és molt més llarga.
- algunes activitats del 2026-08-19 apareixen completament buides.
- el recompte d'activitats augmenta, però les dades mostrades no corresponen a les sessions originals.

Les sessions reals que he proporcionat com a referència tenen durades de **com a mínim uns 20 minuts**. Per tant, 4 o 5 minuts NO es poden considerar una dada vàlida inventada per defecte.

## REFERÈNCIES REALS

He proporcionat captures de sessions reals on es veu, per exemple:
- 18/06/2026 — Córrer — 22:07.5 — 3,02 km — 07:19/km
- 11/06/2026 — Córrer — 20:13.6 — 3,01 km — 06:43/km
- 08/06/2026 — Córrer — 21:34.7 — 3,02 km — 07:09/km
- 09/06/2026 — Bicicleta estàtica — 38:01.3 — 243 kcal
- 20/01/2025 — Ciclismo — 22:48.8 — 277 kcal — FC mitjana 145 lpm
- també hi ha sessions antigues de més de 10–20 minuts.

## QUÈ NECESSITO

NO vull que simplement es posin valors per defecte ni que es maquillin les dades.

Investiga el flux complet:
1. origen de les activitats sincronitzades;
2. resposta de l'API / dades rebudes;
3. transformació/mapping de cada activitat;
4. conversió de durada, distància, ritme, calories i freqüència cardíaca;
5. persistència a la base de dades/local storage;
6. càrrega de la pantalla ACTIVITATS;
7. qualsevol fallback que estigui convertint camps inexistents en 4:00, 5:00 o altres valors artificials.

### REQUISITS DE LA SOLUCIÓ

- Mostrar les dades reals de l'activitat original.
- No inventar durades, distàncies, ritmes, calories ni FC.
- Si un camp realment no existeix a l'origen, mostrar `—`.
- La durada ha de conservar la durada real, inclosos minuts i segons.
- No convertir una activitat real de 20+ minuts en 4 o 5 minuts.
- Evitar duplicats en cada sincronització: sincronitzar ha d'afegir només activitats noves o actualitzar les existents, no crear còpies repetides.
- Revisar també per què el recompte arriba a centenars d'activitats quan les dades mostrades són incorrectes.
- No eliminar les activitats reals ja existents sense una migració segura.
- No fer canvis visuals innecessaris: el problema principal és la integritat i el mapping de dades.

## PROVA OBLIGATÒRIA

Abans de donar el problema per resolt, fes una prova amb les dades reals i comprova que una activitat com la del 18/06/2026 conserva aproximadament:
**22:07.5 / 3,02 km / 07:19/km**

I que la del 11/06/2026 conserva:
**20:13.6 / 3,01 km / 06:43/km**

Si l'origen de dades és diferent d'aquestes captures, identifica exactament quin camp de l'API correspon a cada valor i explica el mapping.

## IMPORTANT

No donis per solucionat el problema només perquè ara apareguin minuts a la pantalla. Cal demostrar que els minuts coincideixen amb la durada real de l'activitat i que no s'estan generant valors artificials.
