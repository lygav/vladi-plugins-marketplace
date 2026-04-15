---
name: docs-content-standards
confidence: high
extracted_from: v0.5.0 docs rewrite session
applies_to: all user-facing documentation
---

# Documentation Content Standards

## When to Use
Writing or reviewing any user-facing documentation (README, Astro/Starlight sites, SKILL.md files, guides, tutorials, API docs).

## Core Rules

### 1. NO History References
- ❌ "v0.4.0 introduced...", "previously...", "before this release..."
- ❌ Evolution narrative explaining how something changed
- ✅ Describe current state ONLY
- ✅ Example: "The setup skill guides you through initialization" (not "we added a setup skill in v0.5.0")

### 2. NO Manual CLI as Primary Path
- ❌ "Run `npx tsx scripts/onboard.ts --org=myorg`" as primary instruction
- ❌ Shell commands as the main way users interact with the system
- ✅ "Tell the onboarding skill your organization name" (users interact via Copilot skills)
- ✅ Shell commands in ADVANCED/REFERENCE section only
- **Context:** Federation plugin works through Copilot conversational skills, not manual CLI tool

### 3. Describe Conversational Skill Flow
- Show what the skill asks
- Show what the user answers
- Show what happens next
- Example: "The setup skill asks for your GitHub org, then your team name, then creates the team directory"

### 4. Scripts are Reference/Advanced Only
- Shell commands, script flags, API calls — REFERENCE section
- Not the main instruction path
- Users see skill conversations, not script invocations
- OK to document scripts thoroughly, just not as primary UX

### 5. NO Manual Config File Editing
- ❌ "Use `cat` to view the file, then `vim` to edit config.json"
- ❌ Tell users to manually add properties to JSON
- ✅ "The skill generates the config file for you"
- ✅ If users must view config: "The config is stored in `.squad/config.json` for reference"

### 6. Verify Product Names & References
- Archetype names must match code exactly
- Feature names must match implementation
- Check links actually exist and use correct base path
- **Tool:** Use Opus for accuracy review (catches typos that Sonnet misses)

### 7. Base Path on Deployed Sites
- GitHub Pages Astro sites need `site` + `base` in astro.config.mjs
- ✅ `base: '/repo-name/'` → CSS loads from `/{repo-name}/assets/...`
- ❌ Missing base → CSS loads from `/assets/...` and breaks
- Links to assets must include base path: `/docs/guides/` not `docs/guides/`

## Review Process

### Three-Pass Review Pattern
1. **First pass (fast model, Haiku)** — Structure, completeness, organization
   - All required sections present?
   - Logical flow?
   - Links to right pages?

2. **Second pass (claude-opus-4.6)** — Content accuracy
   - Product names correct (archetype names, feature names)?
   - Rules violations (history refs, manual CLI as primary)?
   - Broken links?
   - Stale command references?
   - Example accuracy?

3. **Third pass (quick verification)** — Spot-check fixes
   - Fixes applied correctly?
   - No new issues introduced?
   - Links still work?

**Why three passes?** Each catches different issues. Combined single pass misses things.

## Common Violations & Fixes

### ❌ History Reference
```
"In v0.4.0, we introduced the federation plugin..."
```
**Fix:**
```
"The federation plugin..."
```

### ❌ Manual CLI as Primary
```
"To set up, run: npx tsx scripts/onboard.ts --org myorg"
```
**Fix:**
```
"The onboarding skill will ask for your organization name, then create your team workspace."
```

### ❌ Manual Editing
```
"Edit .squad/config.json and add 'teams': [...]"
```
**Fix:**
```
"The setup skill creates your configuration file automatically. Your config is stored in .squad/config.json for reference."
```

### ❌ Missing Base Path
```
astro.config.mjs:
export default defineConfig({
  site: 'https://username.github.io/repo',
  // base missing!
})
```
**Fix:**
```javascript
export default defineConfig({
  site: 'https://username.github.io',
  base: '/repo/',  // REQUIRED
})
```

## Tools & Patterns

### Parallel Docs Rewriting
For large doc rewrites (>10 files):
1. Split by section (guides, reference, archetypes, etc.)
2. Assign different writers to different sections
3. No file overlap → parallel work
4. Batch commit all sections together at end
5. Single PR with clear commit message

### Astro/Starlight Specific
- Use starlight-theme-obsidian for clean, modern theme
- Config: `site` + `base` both required
- Deploy workflow: add `workflow_dispatch` trigger
- Test in deployed environment (links break on live site if base missing)

### Accuracy Checking
- Grep code for archetype names, config keys, interface names
- Verify examples against actual code behavior
- Test links in deployed environment
- Use Opus for final accuracy review

## Confidence & Maturity
- **Confidence:** High (extracted from v0.5.0 docs rewrite)
- **Domain:** Generalizable to any project with conversational skill flow
- **Tested on:** Federation plugin docs rewrite (5 section rewrites, Astro site, README)
