# ADR 001 — Monolithe modulaire vs microservices
Date: 2026-09-10
Décision: Monolithe modulaire (un deploy, N modules avec ports/interfaces).
Conséquence: Extraction future sans rewrite — remplacer import par HttpAdapter.
