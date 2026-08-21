# BOMBER TRAINER — VERSIÓ NO FUNCIONA

Aquesta branca és una còpia de l'estat actual del projecte per analitzar el problema de les activitats sincronitzades.

Problema observat:
- Les activitats importades apareixen, però moltes mostren Temps com `—`.
- En alguns casos apareixen durades inventades com 4:00 o 5:00, que no corresponen a les sessions reals.
- Les sessions reals aportades per l'usuari són d'almenys aproximadament 20 minuts en diversos casos.
- Les activitats han d'importar les dades reals de les sessions sincronitzades i no reutilitzar la durada planificada/local.
- També cal evitar duplicats en sincronitzar: només s'han d'afegir activitats noves.

Aquesta versió NO es considera solucionada. S'ha preparat expressament perquè un altre agent pugui investigar i solucionar l'arrel del problema sense perdre l'estat actual.
