---
name: github-pages-astro
confidence: high
extracted_from: Astro Starlight deployment to GitHub Pages, issue #102
---

# GitHub Pages Astro Deployment

## When to Use
When deploying an Astro Starlight documentation site to GitHub Pages, especially as a subdirectory of an existing repository.

## Pattern
GitHub Pages requires specific configuration for Astro to serve assets correctly. The site lives at `https://{user}.github.io/{repo}/` not the root.

**Required Configuration:**

1. **astro.config.mjs**
   ```javascript
   export default defineConfig({
     site: 'https://username.github.io',
     base: '/repo-name',  // Repository name as path prefix
     integrations: [starlight({...})]
   });
   ```

2. **GitHub Actions Workflow** (`.github/workflows/deploy-docs.yml`)
   ```yaml
   - name: Build
     working-directory: ./docs  # Set if Astro site is in subdirectory
     run: npm run build
   
   - name: Deploy
     uses: actions/configure-pages@v3
     # Upload from docs/dist/ not root dist/
   ```

3. **Node Version**
   - Use Node 24.x or newer (Node 22 has compatibility issues with Astro 5.x)
   - Specify in workflow: `node-version: '24'`

4. **GitHub Pages Settings**
   - Source: GitHub Actions (not "Deploy from branch")
   - Branch: Not applicable for Actions deployment
   - Enable "Enforce HTTPS"

## Example
```javascript
// astro.config.mjs for plugin-developer repo
export default defineConfig({
  site: 'https://vladimirlyga.github.io',
  base: '/plugin-developer',  // Repo name
  integrations: [
    starlight({
      title: 'Plugin Developer Docs',
      // ...
    })
  ]
});
```

## Common Mistakes
- ❌ Forgetting `base:` config → assets 404 (looking at root instead of /repo-name/)
- ❌ Using `base: '/'` → works locally, fails in GitHub Pages
- ❌ Wrong `working-directory` in workflow → builds from wrong location
- ❌ Node 22 → compatibility issues with Astro 5.x

## Verification
After deployment, check:
- Main page loads: `https://username.github.io/repo-name/`
- Assets load correctly (check DevTools Network tab)
- Internal links work (shouldn't 404)
- CSS/JS bundles load from `/repo-name/_astro/`
