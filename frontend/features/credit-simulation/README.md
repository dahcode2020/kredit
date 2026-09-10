# feature: credit-simulation
Slice métier simulation — UI + hook + service + schema + types.
- `Simulator.tsx` (déplacé depuis components/credit pour feature-slice)
- `useSimulator.ts` -> appelle `services/simulation.service.ts` (REST /api/v1/credit/simulations)
- `simulation.schema.ts` -> Zod (amount, term, productType)
