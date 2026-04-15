---
title: Deliverable Archetype
description: Teams that create documents and reports
---

# Deliverable Archetype

The **deliverable** archetype is designed for teams that produce documentation, reports, or non-code artifacts.

## Purpose

Deliverable teams:
- Write documentation
- Create analysis reports
- Generate diagrams
- Produce specifications
- Compile findings

**Output:** Markdown documents, reports, artifacts

## States

```
initializing
    ↓
gathering ←→ paused
    ↓
composing ←→ paused
    ↓
complete (✓)

(any state) → failed (✗)
```

| State | Description | Duration |
|-------|-------------|----------|
| `initializing` | Setting up workspace | <1min |
| `gathering` | Collecting information, reading files | 5-15min |
| `composing` | Writing deliverable document | 10-20min |
| `complete` | Document finished | (terminal) |
| `failed` | Error occurred | (terminal) |
| `paused` | Manually paused | (indefinite) |

## Agents

### Lead Agent

**Role:** Primary writer and researcher

**Responsibilities:**
- Gather information from codebase
- Analyze findings
- Write deliverable document
- Format and structure content
- Ensure completeness

**Tools:** `view`, `grep`, `glob`, `bash` (read-only)

**Temperature:** 0.3 (balanced)

## Skills

Deliverable teams have access to:

1. **documentation-standards.md** - Markdown conventions, structure guidelines
2. **report-templates.md** - Report formats (architecture, analysis, audit)
3. **diagram-tools.md** - Mermaid, PlantUML syntax

### Example: Documentation Standards

```markdown
---
tags: [documentation, markdown, standards]
category: convention
---

# Documentation Standards

## Structure

Every document should have:

1. **Title** - Clear, descriptive
2. **Summary** - 2-3 sentence overview
3. **Table of Contents** - For long docs (>500 words)
4. **Sections** - Logical grouping
5. **Code Examples** - Syntax-highlighted
6. **Next Steps** - Action items

## Markdown

- Use ATX headings (`#`, `##`, `###`)
- Code blocks with language: \`\`\`typescript
- Lists with `-` (unordered) or `1.` (ordered)
- Links: `[text](url)`
- Emphasis: `**bold**`, `*italic*`

## Diagrams

Use Mermaid for flowcharts:

\`\`\`mermaid
graph TD
  A[Start] --> B[Process]
  B --> C{Decision}
  C -->|Yes| D[Action]
  C -->|No| E[End]
\`\`\`
```

## Typical Workflow

### Phase 1: Initialization (30s)

1. Team workspace created
2. Archetype files copied
3. `.squad/` directory initialized
4. Status set to `initializing`

### Phase 2: Gathering (5-15min)

1. Lead agent reads mission
2. Searches codebase for relevant files
3. Reads documentation, code, configs
4. Extracts key information
5. Logs findings to learning log
6. Updates status: `state: "gathering", progress_pct: 40`

**Example findings:**

```json
{
  "timestamp": "2025-01-30T12:00:00Z",
  "domain": "docs-team",
  "category": "discovery",
  "content": "Project uses monorepo structure with 3 packages",
  "tags": ["architecture", "documentation"],
  "context": "Found in package.json workspaces field"
}
```

### Phase 3: Composing (10-20min)

1. Lead agent structures deliverable
2. Writes sections based on findings
3. Adds code examples, diagrams
4. Formats according to standards
5. Saves as `deliverable.md`
6. Updates status: `state: "composing", progress_pct: 80`

### Phase 4: Complete (terminal)

1. Status set to `complete`
2. Deliverable available at `deliverable.md`
3. Team session can be stopped

## Deliverable Format

Deliverable teams produce well-structured markdown documents.

**Example: Architecture Documentation**

```markdown
# Frontend Architecture

## Summary

The frontend is a React SPA using TypeScript, Vite, and React Router. State management uses Context API with custom hooks. Authentication is JWT-based with httpOnly cookies.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [State Management](#state-management)
- [Routing](#routing)
- [Authentication](#authentication)
- [API Integration](#api-integration)
- [Testing](#testing)

## Architecture Overview

\`\`\`mermaid
graph TD
  A[User] --> B[React SPA]
  B --> C[React Router]
  B --> D[Context API]
  B --> E[API Client]
  E --> F[Backend API]
\`\`\`

**Key Technologies:**
- **Framework:** React 18
- **Build Tool:** Vite 4
- **Language:** TypeScript 5
- **Router:** React Router 6
- **State:** Context API + hooks

## Directory Structure

\`\`\`
src/
├── components/     ← Reusable UI components
├── pages/          ← Route-level pages
├── hooks/          ← Custom React hooks
├── contexts/       ← Context providers
├── api/            ← API client
├── utils/          ← Helper functions
└── types/          ← TypeScript types
\`\`\`

## State Management

Global state managed via Context API:

\`\`\`typescript
// src/contexts/AuthContext.tsx
export const AuthContext = createContext<AuthState>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {}
});
\`\`\`

**Contexts:**
- `AuthContext` - User authentication
- `ThemeContext` - UI theme (light/dark)
- `NotificationContext` - Toast notifications

## Authentication

JWT tokens stored in httpOnly cookies:

\`\`\`typescript
// src/api/auth.ts
export async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',  // ← Send cookies
    body: JSON.stringify({ email, password })
  });
  return response.json();
}
\`\`\`

**Flow:**
1. User submits login form
2. API sets httpOnly cookie with JWT
3. Subsequent requests include cookie automatically
4. API validates JWT on each request

## Testing

\`\`\`bash
npm run test          # Run all tests
npm run test:coverage # Generate coverage report
\`\`\`

**Coverage:**
- Components: 85%
- Hooks: 90%
- Utils: 95%

## Next Steps

1. Add E2E tests with Playwright
2. Implement lazy loading for routes
3. Add error boundary component
```

## Monitoring

Deliverable teams emit metrics:

- `deliverable.size_bytes` - Document size
- `deliverable.sections` - Section count
- `deliverable.code_examples` - Code blocks included

**Health checks:**

- Deliverable file exists
- Size > 1000 bytes (substantive content)
- Status updated within 10 minutes

## Common Use Cases

### Architecture Documentation

**Mission:** "Document the frontend architecture"

**States:** `initializing → gathering → composing → complete`

**Output:**
- `deliverable.md` with sections:
  - Overview
  - Directory structure
  - State management
  - Routing
  - Authentication
  - Testing

### Analysis Report

**Mission:** "Analyze database schema and create ER diagram"

**States:** `initializing → gathering → composing → complete`

**Output:**
- `deliverable.md` with:
  - Summary of tables
  - ER diagram (Mermaid)
  - Relationships
  - Observations

### Security Audit

**Mission:** "Review authentication flow for security issues"

**States:** `initializing → gathering → composing → complete`

**Output:**
- `deliverable.md` with:
  - Current implementation
  - Security findings
  - Recommendations
  - Priority ranking

## Tips

### Clear Structure

Use headings, lists, and code blocks:

```markdown
## Authentication Flow

1. User submits login form
2. Server validates credentials
3. Server issues JWT token
4. Client stores token
5. Client includes token in requests

\`\`\`typescript
// Example token validation
if (!verifyToken(token)) {
  throw new Error('Invalid token');
}
\`\`\`
```

### Visual Aids

Include diagrams (Mermaid):

```markdown
\`\`\`mermaid
sequenceDiagram
  User->>Frontend: Submit login
  Frontend->>Backend: POST /auth/login
  Backend-->>Frontend: JWT cookie
  Frontend->>Backend: GET /api/profile
  Backend-->>Frontend: User data
\`\`\`
```

### Code Examples

Show, don't tell:

```markdown
❌ "The API client uses fetch"

✅ "The API client uses fetch with credentials:

\`\`\`typescript
fetch('/api/endpoint', {
  credentials: 'include'
})
\`\`\`
"
```

### Actionable Findings

Provide next steps:

```markdown
## Recommendations

1. **High Priority:** Enable HTTPS in production
2. **Medium Priority:** Add rate limiting to login endpoint
3. **Low Priority:** Rotate JWT secret monthly
```

## Deliverable vs Coding

| Aspect | Deliverable | Coding |
|--------|-------------|--------|
| **Output** | Documents | Code |
| **States** | gathering/composing | scanning/distilling |
| **Changes** | None to codebase | Modifies files |
| **Tools** | Read-only | Read + write |

**Use deliverable when:**
- No code changes needed
- Creating documentation
- Analysis/reporting

**Use coding when:**
- Implementing features
- Fixing bugs
- Refactoring

## Next Steps

- [View coding archetype](/archetypes/coding)
- [View consultant archetype](/archetypes/consultant)
- [Create custom archetypes](/archetypes/creating-archetypes)
