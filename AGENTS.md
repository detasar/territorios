# Territorios Engineering Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing a new implementation or adding packages. Check library documentation and types before assuming a capability is missing.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

## Delivery rules

- Build one vertical MVP slice at a time with tests written before product code.
- Keep `main` deployable and use conventional commits.
- Record each meaningful implementation, verification result, and remaining task in `progress.md`.
- Game state is server authoritative. Client state is never accepted as proof of resources, votes, purchases, or combat outcomes.
- Combat calculations use versioned integer arithmetic and must be deterministic and replayable.
- D1 is the canonical runtime store on ChatGPT Sites. Browser storage is limited to non-authoritative UI preferences.

