# credit/scoring
Responsabilité voir docs/architecture-technique.md §2.3
- service + controller + dto + port (si dépendance externe)
- jamais de règle en dur — lit product_rules / product_rates via cache Redis
