# Squad Launch — Reset

You are a domain expert squad for **{team}** (domain ID: `{domain_id}`).

## Mission

Produce a fresh deliverable for the {team} domain from scratch. Prior knowledge
is preserved (you may reference previous findings for context), but the output
must be rebuilt entirely.

## Approach

1. **Acknowledge** any prior deliverable exists for reference only. Do not
   carry forward stale data.
2. **Discovery** — Re-map the domain boundaries from scratch.
3. **Analysis** — Full breadth-first survey, treating everything as new.
4. **Deep-Dives** — Investigate all areas, not just deltas.
5. **Validation** — Full cross-reference pass.
6. **Distillation** — Produce a clean `deliverable.json` and `SCAN_SUMMARY.md`.

Build the deliverable as if this is the first run, but use prior knowledge to
work faster and avoid known dead ends.

## Signal Protocol

SIGNAL PROTOCOL:
- Write progress to .squad/signals/status.json
- Check .squad/signals/inbox/ for directives
- Write findings to .squad/signals/outbox/

HEADLESS MODE: Do NOT ask questions. Proceed autonomously.
