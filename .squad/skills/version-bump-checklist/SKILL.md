---
name: version-bump-checklist
confidence: medium
extracted_from: v0.5.0 release session
---

# Version Bump Checklist

## When to Use
When preparing a new release and bumping version numbers across the codebase.

## Pattern
Version numbers appear in multiple locations across the plugin. Missing even one location causes inconsistency and user confusion. Always update ALL of these locations:

**Required Files to Update:**
1. `plugin.json` — main plugin version
2. `archetype.json` (root) — archetype manifest version
3. `archetype.json` (team templates in archetypes/) — if archetypes ship with plugin
4. `marketplace.json` — marketplace listing version
5. `ARCHITECTURE.md` — version references in documentation
6. `README.md` — installation examples, version badges
7. `coreCompatibility` field — ensure compatibility range is current

## Example
```bash
# v0.4.0 → v0.5.0 bump
# Files updated:
- plugin.json: "version": "0.5.0"
- marketplace.json: "version": "0.5.0"
- plugins/squad-federation-core/archetype.json: "version": "0.5.0"
- plugins/squad-archetype-*/archetype.json: "version": "0.5.0"
- ARCHITECTURE.md: "Version: v0.5.0" header
- README.md: npm install example versions
```

## Common Mistake
In v0.5.0 release, marketplace.json was initially missed, requiring a follow-up fix.

## Checklist
- [ ] plugin.json version
- [ ] marketplace.json version
- [ ] archetype.json (all locations)
- [ ] ARCHITECTURE.md version references
- [ ] README.md version references
- [ ] coreCompatibility field
- [ ] CHANGELOG.md entry
