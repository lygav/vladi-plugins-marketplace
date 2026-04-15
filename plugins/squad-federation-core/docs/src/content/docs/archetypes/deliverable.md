---
title: Deliverable Archetype
description: Teams that create documentation, reports, and analysis artifacts
---

# Deliverable Archetype

The **deliverable** archetype is for teams that produce documentation, reports, or non-code artifacts—without modifying the codebase.

## What It Does

Deliverable teams:
- Write documentation
- Create analysis reports
- Generate diagrams
- Produce specifications
- Compile research findings

**Output:** Markdown documents, reports, diagrams

## Lifecycle States

```
preparing
  ↓
scanning
  ↓
distilling
  ↓
aggregating
  ↓
complete

(any state) → failed
(any non-terminal state) → paused
```

| State | Description | Typical Duration |
|-------|-------------|------------------|
| `preparing` | Reading mission, planning document structure | 2-3 minutes |
| `scanning` | Gathering information from codebase | 10-20 minutes |
| `distilling` | Processing findings, identifying key insights | 5-10 minutes |
| `aggregating` | Writing deliverable document, formatting | 10-15 minutes |
| `complete` | Document finished | (terminal) |
| `failed` | Error occurred | (terminal) |
| `paused` | Manually paused | (indefinite) |

### State Transitions

**preparing → scanning**
- Read mission from inbox signal
- Plan document structure
- Identify information sources (files, directories)

**scanning → distilling**
- Read relevant files (code, configs, docs)
- Extract key information
- Log findings to learning log

**distilling → aggregating**
- Identify patterns and insights
- Organize information logically
- Select examples and code snippets

**aggregating → complete**
- Write deliverable markdown
- Add diagrams (Mermaid)
- Format according to standards
- Save as `deliverable.md`

**(any state) → failed**
- Cannot find required information
- Source files are corrupted or inaccessible
- Document structure cannot be determined

## Skills

Deliverable teams have access to documentation skills in `.squad/skills/`:

1. **documentation-standards.md** — Markdown conventions, structure guidelines
2. **report-templates.md** — Report formats (architecture, analysis, audit)
3. **diagram-tools.md** — Mermaid and PlantUML syntax

### Example Skill: Documentation Standards

```markdown
---
tags: [documentation, markdown, standards]
category: convention
---

# Documentation Standards

## Structure

Every document should have:

1. **Title** — Clear, descriptive
2. **Summary** — 2-3 sentence overview
3. **Table of Contents** — For long docs (>500 words)
4. **Sections** — Logical grouping
5. **Code Examples** — Syntax-highlighted
6. **Next Steps** — Action items

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

## Agent Configuration

### Lead Agent

**Role:** Writer and researcher

**Model:** `claude-sonnet-4`

**Temperature:** `0.3` (balanced—slightly creative)

**Tools:** `view`, `grep`, `glob`, `bash` (read-only)

**Responsibilities:**
- Gather information from codebase
- Analyze findings
- Write deliverable document
- Format and structure content

## Typical Workflow

### Phase 1: Preparing

1. Team receives signal: "Document the frontend architecture"
2. Agent plans document structure:
   - Overview
   - Directory structure
   - State management
   - Routing
   - Authentication
   - Testing
3. Transitions to `scanning`

### Phase 2: Scanning

1. Agent searches for relevant files:
   - `package.json` — Dependencies
   - `src/` directory — Code structure
   - `vite.config.ts` — Build config
   - `README.md` — Setup instructions
2. Reads key files:
   - `src/contexts/AuthContext.tsx` — Auth implementation
   - `src/App.tsx` — Routing setup
   - `src/hooks/useAuth.ts` — Custom hooks
3. Logs findings:
   ```json
   {
     "timestamp": "2025-01-30T12:00:00Z",
     "domain": "docs-team",
     "category": "discovery",
     "content": "Frontend uses Context API for state management",
     "tags": ["architecture", "state", "react"],
     "confidence": "high"
   }
   ```
4. Transitions to `distilling`

### Phase 3: Distilling

1. Agent analyzes findings:
   - Identifies architectural patterns (Context API, React Router)
   - Extracts key technologies (React 18, Vite 4, TypeScript 5)
   - Notes conventions (httpOnly cookies for auth)
2. Organizes information into sections
3. Selects representative code examples
4. Transitions to `aggregating`

### Phase 4: Aggregating

1. Agent writes `deliverable.md`:
   - Summary paragraph
   - Table of contents
   - Section-by-section content
   - Code examples
   - Mermaid diagrams
   - Next steps
2. Formats according to `documentation-standards.md`
3. Transitions to `complete`

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
- [Testing](#testing)
- [Next Steps](#next-steps)

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
- `AuthContext` — User authentication
- `ThemeContext` — UI theme (light/dark)
- `NotificationContext` — Toast notifications

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

## Common Use Cases

### Architecture Documentation

**Mission:** "Document the frontend architecture"

**States:** `preparing → scanning → distilling → aggregating → complete`

**Duration:** 30-45 minutes

**Output:**
- Comprehensive architecture doc
- Directory structure diagram
- Code examples
- Technology stack overview

---

### Analysis Report

**Mission:** "Analyze database schema and create ER diagram"

**States:** `preparing → scanning → distilling → aggregating → complete`

**Duration:** 20-30 minutes

**Output:**
- Table summaries
- ER diagram (Mermaid)
- Relationship analysis
- Observations and recommendations

---

### Security Audit Report

**Mission:** "Review authentication flow for security issues"

**States:** `preparing → scanning → distilling → aggregating → complete`

**Duration:** 30-40 minutes

**Output:**
- Current implementation analysis
- Security findings (ranked by severity)
- Recommendations
- Code examples

## Best Practices

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

❌ "The API client uses fetch with credentials"

✅ "The API client uses fetch with credentials:

\`\`\`typescript
fetch('/api/endpoint', {
  credentials: 'include'
})
\`\`\`
"

### Actionable Next Steps

Provide concrete follow-up items:

```markdown
## Next Steps

1. **High Priority:** Enable HTTPS in production
2. **Medium Priority:** Add rate limiting to login endpoint
3. **Low Priority:** Rotate JWT secret monthly
```

## Deliverable vs Coding

| Aspect | Deliverable | Coding |
|--------|-------------|--------|
| **Output** | Documents | Code |
| **States** | scanning/distilling/aggregating | implementing/testing/pr-open |
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

## Monitoring

Deliverable teams emit telemetry (when enabled):

- `deliverable.size_bytes` — Document size
- `deliverable.sections` — Section count
- `deliverable.code_examples` — Code blocks included

**Health checks:**
- Deliverable file exists and is non-empty
- Status updated within 10 minutes
- No errors in logs

## Next Steps

- [View coding archetype](/vladi-plugins-marketplace/archetypes/coding)
- [View consultant archetype](/vladi-plugins-marketplace/archetypes/consultant)
- [Create custom archetypes](/vladi-plugins-marketplace/archetypes/creating-archetypes)
