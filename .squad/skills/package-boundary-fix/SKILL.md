---
name: package-boundary-fix
confidence: high
extracted_from: ESM import error resolution, v0.5.0
---

# Package Boundary Fix

## When to Use
When encountering ESM import errors like:
- "Cannot find module" errors across directory boundaries
- Relative imports failing between nested directories
- TypeScript path aliases not resolving correctly
- Module resolution errors in monorepo or plugin structures

## Pattern
**Root Cause:** Separate package.json files in nested directories create package boundaries. Node.js and TypeScript treat each package.json as a module resolution root, breaking imports across boundaries.

**Solution:** Single package.json at the common ancestor directory of all code.

**Before (broken):**
```
plugin-root/
├── scripts/
│   ├── package.json  ← Creates boundary
│   └── lib/
│       └── registry/team-registry.ts
└── plugins/
    └── squad-federation-core/
        └── sdk/types.ts  ← Cannot import from scripts/
```

**After (fixed):**
```
plugin-root/
├── package.json      ← Single source at root
├── scripts/
│   └── lib/
│       └── registry/team-registry.ts
└── plugins/
    └── squad-federation-core/
        └── sdk/types.ts  ← Can now import from scripts/
```

## Example
```bash
# Error before fix:
# scripts/onboard.ts imports from plugins/squad-federation-core/sdk/
# Error: Cannot find module '../plugins/squad-federation-core/sdk/types'

# Fix applied:
1. Move scripts/package.json content to root package.json
2. Delete scripts/package.json
3. Update imports to use correct relative paths
4. Rebuild and verify imports resolve
```

## Key Insight
Don't fight module resolution with complex tsconfig.json path mappings. Fix the package structure instead. One package.json per package boundary is the simplest solution.
