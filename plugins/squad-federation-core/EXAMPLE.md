# Federation Walkthrough: From Zero to Running Teams

**A complete end-to-end example** showing how Squad Federation works — from a bare project to multiple autonomous teams working in parallel.

---

## The Scenario

Alex has a simple portfolio site — just a static HTML page, a stylesheet, and a README. They want to redesign it as a modern React site with a blog. Instead of doing everything solo, Alex will use Squad Federation to organize autonomous AI teams: a leadership team (meta-squad) that coordinates, and specialist teams that do the work.

Here's what the project looks like at the start:

```
alex-portfolio/
├── index.html
├── styles.css
└── README.md
```

Nothing fancy. No frameworks, no build tools, no Squad. Let's change that.

---

## 1. Install Squad + Federation

First, Alex installs Squad (the agent framework) and initializes it in the project:

```bash
cd alex-portfolio
npm install -g @bradygaster/squad-cli
squad init
```

Squad is now set up — it provides the agent framework, casting system, and coordinator. Next, install the federation plugin:

```bash
copilot plugin install squad-federation-core@vladi-plugins-marketplace
```

The project now has Squad's `.squad/` directory and the federation plugin is available. Time to set up the organization.

---

## 2. Set Up Federation

Alex opens a Copilot session and describes what they want:

**Alex:**
I want to set up a team organization to redesign my portfolio as a modern React site with blog

> **Copilot** *(federation-setup skill activates):*
>
> Great — let me check your environment first.
>
> ```
> ✅ git 2.43.0
> ✅ Node.js v22.4.0
> ✅ Squad initialized (.squad/team.md found)
> ⚠️  Docker not found (OTel dashboard unavailable — can enable later)
> ✅ Git repository, clean working tree
> ```
>
> Everything looks good. Let me walk you through the setup.
>
> **What type of work will your squads do?**
>
> - **Coding** — squads implement features, output is pull requests
> - **Deliverable** — squads produce file artifacts (JSON output)
> - **Research** — squads investigate, output is design docs
> - **Task** — squads execute work items
>
> You can mix types later — a meta-squad can manage different kinds of teams.

**Alex:**
Coding — the main team will build React components and pages

> **Copilot:**
>
> Got it — coding archetype. Installing now...
>
> ```bash
> copilot plugin install squad-archetype-coding@vladi-plugins-marketplace
> ```
>
> ✅ `squad-archetype-coding` installed.
>
> **What MCP servers should your teams have access to?**
> These give Copilot sessions their tools. Defaults: `filesystem`, `otel`.

**Alex:**
Defaults are fine, maybe add fetch too for npm lookups

> **Copilot:**
>
> Got it — `filesystem`, `otel`, `fetch`.
>
> **List the teams you want in this federation.** Each gets its own branch, worktree, and agent team. You can add more later.

**Alex:**
Just one for now — a frontend team for the React redesign. I might add a content/blog team later.

> **Copilot:**
>
> Perfect. One team to start: `frontend-redesign`.
>
> **Workflow steps for coding teams?** Default pipeline:
> 1. `design` — plan architecture and component structure
> 2. `implement` — write the code
> 3. `test` — add tests and verify
> 4. `pr` — open a pull request with the changes
>
> Want to customize this?

**Alex:**
That works. Let's go with it.

> **Copilot:**
>
> Last question — **telemetry?** Docker isn't installed, so the Aspire dashboard won't be available right now. I'll enable telemetry anyway — you can point it at a collector later.

**Alex:**
Sure, leave it enabled.

> **Copilot:**
>
> ✅ Generated `federate.config.json`:

```json
{
  "branchPrefix": "squad/",
  "mcpStack": ["filesystem", "otel", "fetch"],
  "telemetry": {
    "enabled": true
  }
}
```

> **Copilot:**
>
> This config is intentionally minimal — it only covers federation plumbing. Team-specific behavior (playbook, prompts, cleanup) lives inside each worktree, managed by the coding archetype.
>
> Now let me cast your **meta-squad** — the leadership team on the main branch that coordinates everything.

Squad casts the meta-squad. The casting system draws from the Star Trek universe (Squad's default theme):

> **Copilot:**
>
> 🎬 Meta-squad cast:
>
> | Role | Agent | Purpose |
> |------|-------|---------|
> | Lead Architect | **Picard** | Strategic decisions, team coordination |
> | Scribe | **Scribe** | Documentation, learning log |
> | Coordinator | **Ralph** | Task tracking, signal management |
>
> Your meta-squad lives on `main`. They manage the federation — onboarding teams, monitoring progress, syncing knowledge.
>
> **Ready to onboard your first team?**

### Checkpoint: Project State After Setup

```
alex-portfolio/
├── .squad/
│   ├── team.md              ← meta-squad definition (Picard, Scribe, Ralph)
│   ├── skills/              ← shared skills (authoritative copies)
│   └── learnings/
│       └── log.jsonl        ← cross-cutting patterns (empty)
├── federate.config.json     ← federation plumbing config
├── index.html
├── styles.css
└── README.md
```

---

## 3. Onboard the Frontend Team

**Alex:**
Yes, spin off a frontend team for the React redesign

> **Copilot** *(federation-orchestration skill activates):*
>
> 🏗️ Onboarding team: **Frontend Redesign**
>
> Running `onboard.ts`...
>
> ```
> Creating branch: squad/frontend-redesign from main
> Creating worktree: /Users/alex/alex-portfolio-frontend-redesign
> Seeding template files...
>   ✓ Seeded README.md
> Scaffolding federation state...
>   ✓ Signal protocol (inbox/, outbox/, status.json)
>   ✓ Learnings directory
>   ✓ Ceremonies definition
>   ✓ Telemetry config
>   ✓ DOMAIN_CONTEXT.md
> Initializing squad (team casting handled by Squad)...
> ✓ Squad initialized
> Committing initial state...
>
> ✅ Team onboarded: Frontend Redesign
>    Worktree: /Users/alex/alex-portfolio-frontend-redesign
>    Branch: squad/frontend-redesign
> ```

Squad then casts the team in the worktree. For a coding team, it selects agents suited for frontend development:

> **Copilot:**
>
> 🎬 Team cast for **frontend-redesign**:
>
> | Role | Agent | Specialty |
> |------|-------|-----------|
> | Lead Dev | **Torres** | React architecture, build systems |
> | UI/UX | **Troi** | Component design, accessibility, styling |
> | Tester | **Data** | Test coverage, integration testing |
>
> The coding archetype has seeded `launch-prompt.md` into the worktree — this is the prompt the team will receive when launched.

### The Launch Prompt

The coding archetype writes `.squad/launch-prompt.md` into the worktree. This is the prompt the team sees when launched:

```markdown
You are team {team}. This is a {runType}.

## Your Mission
Read DOMAIN_CONTEXT.md for the full context of what you're building.

## Workflow
Follow your coding-playbook skill through these steps:
1. **design** — Plan the architecture, component tree, file structure
2. **implement** — Write the code, components, styles, configuration
3. **test** — Add tests, verify everything works
4. **pr** — Open a pull request with your changes

## Signals Protocol
- Check .squad/signals/inbox/ before each step for directives
- Update .squad/signals/status.json at each step transition
- Report blockers or findings to .squad/signals/outbox/

## Rules
- You are running in HEADLESS mode — do not ask questions
- If blocked, write a question to your outbox and continue with best judgment
- Log learnings to .squad/learnings/log.jsonl as you discover things
```

The `{team}` and `{runType}` placeholders are interpolated at launch time.

### Checkpoint: Filesystem After Onboarding

The worktree is a sibling directory of the main repo. Both share the same git object store (disk-efficient), but have independent working directories:

```
/Users/alex/
├── alex-portfolio/                          ← main branch (meta-squad)
│   ├── .squad/
│   │   ├── team.md
│   │   ├── skills/
│   │   └── learnings/log.jsonl
│   ├── federate.config.json
│   ├── index.html
│   ├── styles.css
│   └── README.md
│
└── alex-portfolio-frontend-redesign/        ← squad/frontend-redesign branch
    ├── .squad/
    │   ├── team.md                          ← Torres, Troi, Data
    │   ├── launch-prompt.md                 ← from coding archetype
    │   ├── ceremonies.md                    ← ceremony definitions
    │   ├── telemetry.json                   ← OTel config
    │   ├── skills/                          ← seeded from main
    │   ├── learnings/
    │   │   └── log.jsonl                    ← empty, will fill during work
    │   └── signals/
    │       ├── status.json                  ← will be written on launch
    │       ├── inbox/                       ← directives FROM meta-squad
    │       └── outbox/                      ← reports TO meta-squad
    ├── DOMAIN_CONTEXT.md                    ← team's mission brief
    ├── index.html                           ← inherited from main
    ├── styles.css                           ← inherited from main
    └── README.md
```

The `DOMAIN_CONTEXT.md` generated by onboarding:

```markdown
# Domain Context

**Domain:** Frontend Redesign
**Domain ID:** frontend-redesign
**Type:** Permanent domain expert squad (federated model)

## Signal Protocol
This squad uses the inter-squad signal protocol:
- Read .squad/signals/inbox/ before each major step
- Write progress to .squad/signals/status.json
- Report blockers/findings to .squad/signals/outbox/
```

---

## 4. Launch the Team

**Alex:**
Launch the frontend team

> **Copilot:**
>
> Running `launch.ts --team frontend-redesign`...
>
> ```
> 🆕 Launching first-run for team frontend-redesign
>    Worktree: /Users/alex/alex-portfolio-frontend-redesign
>    📡 Signals initialized
>    ✅ Launched — PID: 48291
>    📄 Log: /Users/alex/alex-portfolio-frontend-redesign/run-output.log
>    📊 Status: .squad/signals/status.json
> ```
>
> The team is now running in a headless Copilot session. They received this prompt:
>
> ```
> You are team frontend-redesign. This is a first-run.
> Read DOMAIN_CONTEXT.md for the full context...
> ```
>
> Monitor with: `npx tsx scripts/monitor.ts --watch`

### What Happens Under the Hood

1. **`launch.ts`** detects this is a `first-run` (no `status.json` exists yet)
2. Resolves the prompt via the 4-tier chain:
   - ❌ No `--prompt` CLI flag
   - ❌ No `--prompt-file` CLI flag
   - ✅ Found `.squad/launch-prompt.md` (from coding archetype) → **uses this**
   - _(tier 4 generic fallback not needed)_
3. Interpolates `{team}` → `frontend-redesign`, `{runType}` → `first-run`
4. Initializes the signal protocol: writes initial `status.json`
5. Spawns a **detached** Copilot process in the worktree:
   ```bash
   copilot -p "<resolved prompt>" --yolo --no-ask-user --autopilot \
     --mcp filesystem --mcp otel --mcp fetch
   ```
6. The session runs independently — Alex can close their terminal and the team keeps working

The initial status written by `launch.ts`:

```json
{
  "domain": "frontend-redesign",
  "domain_id": "frontend-redesign",
  "state": "initializing",
  "step": "launching",
  "started_at": "2025-07-20T14:30:00.000Z",
  "updated_at": "2025-07-20T14:30:00.000Z"
}
```

---

## 5. Monitor Progress

A few minutes later, Alex checks in:

**Alex:**
How are my teams doing?

> **Copilot** *(runs `monitor.ts`):*
>
> ```
> 📊 Domain Scan Status
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
>
> 🟡 frontend-redesign                 scanning     implement: Header component
>    Agent: Torres
>    Progress: 35%
>    Last update: 2m ago
>    deliverable.json: ✗   log: ✓
>
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> 📝 Recent Learnings:
>
>   [frontend-redesign] [Torres] Create React App is deprecated — using Vite...
>   [frontend-redesign] [Troi] Portfolio sites benefit from CSS Grid for lay...
>
> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
> Last updated: 2:42:15 PM
> ```

The team's `status.json` at this point:

```json
{
  "domain": "frontend-redesign",
  "domain_id": "frontend-redesign",
  "state": "scanning",
  "step": "implement: Header component",
  "started_at": "2025-07-20T14:30:00.000Z",
  "updated_at": "2025-07-20T14:40:12.000Z",
  "progress_pct": 35,
  "agent_active": "Torres"
}
```

---

## 6. Send a Directive

Alex decides they want a different styling approach:

**Alex:**
Tell the frontend team to use Tailwind CSS instead of styled-components

> **Copilot** *(inter-squad-signals skill activates):*
>
> 📤 Sending directive to frontend-redesign...
>
> ```
> ✅ Directive sent (ID: d7f3a2b1-9e4c-4d8a-b5f6-1a2b3c4d5e6f)
>    Location: alex-portfolio-frontend-redesign/.squad/signals/inbox/
>    Message: "Use Tailwind CSS instead of styled-components for all styling"
> ```

The directive file written to the team's inbox:

```json
{
  "id": "d7f3a2b1-9e4c-4d8a-b5f6-1a2b3c4d5e6f",
  "ts": "2025-07-20T14:45:00.000Z",
  "from": "meta-squad",
  "type": "directive",
  "subject": "Use Tailwind CSS instead of styled-components",
  "body": "Use Tailwind CSS instead of styled-components for all styling. Install tailwindcss and configure it for the Vite + React setup. Use utility classes directly in JSX. Do not install or use styled-components.",
  "acknowledged": false
}
```

**File on disk:**
```
.squad/signals/inbox/2025-07-20T14-45-00-000Z-directive-use-tailwind-css-instead-of-styled-compo.json
```

The team picks up the directive at its next step boundary, acknowledges it (sets `acknowledged: true`), and adjusts course.

---

## 7. Team Completes

After about 45 minutes, the team finishes. Torres opens a PR, Data runs the test suite, and the squad writes a completion report.

The final `status.json`:

```json
{
  "domain": "frontend-redesign",
  "domain_id": "frontend-redesign",
  "state": "complete",
  "step": "pr: Pull request opened",
  "started_at": "2025-07-20T14:30:00.000Z",
  "updated_at": "2025-07-20T15:18:42.000Z",
  "completed_at": "2025-07-20T15:18:42.000Z",
  "progress_pct": 100,
  "agent_active": "Torres"
}
```

The team writes a completion report to their outbox:

```json
{
  "id": "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "ts": "2025-07-20T15:18:42.000Z",
  "from": "frontend-redesign",
  "type": "report",
  "subject": "React redesign complete",
  "body": "## Summary\n\nPortfolio redesigned as a React + Vite + Tailwind CSS application.\n\n### What was built\n- React 18 + Vite project scaffold\n- Header, Hero, Projects, About, Contact components\n- Responsive layout with Tailwind CSS\n- Blog page with markdown rendering (react-markdown)\n- Vitest test suite (14 tests, all passing)\n\n### Pull Request\nOpened PR from `squad/frontend-redesign` → `main`.\n\n### Decisions Made\n- Used Vite over Next.js (static site, no SSR needed)\n- Tailwind CSS per meta-squad directive\n- MDX for blog posts\n\n### Blockers Encountered\nNone.",
  "acknowledged": false
}
```

The monitor now shows:

```
📊 Domain Scan Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 frontend-redesign                 complete     pr: Pull request opened
   Last update: just now
   deliverable.json: ✗   log: ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 8. Knowledge Flows Back

During work, the team logged learnings as they discovered things. These are written to `.squad/learnings/log.jsonl` in the team's worktree.

**Alex:**
What did the frontend team learn?

> **Copilot** *(knowledge-lifecycle skill activates):*
>
> 📝 Learnings from **frontend-redesign** (6 entries):
>
> | # | Type | Title | Confidence | Agent |
> |---|------|-------|------------|-------|
> | 1 | discovery | CRA is deprecated — Vite is the modern default | high | Torres |
> | 2 | technique | CSS Grid + Tailwind for responsive portfolio layouts | high | Troi |
> | 3 | gotcha | Vite requires explicit .jsx extension for JSX files | medium | Torres |
> | 4 | pattern | React component files should co-locate styles and tests | medium | Data |
> | 5 | technique | react-markdown + remark-gfm handles blog content well | high | Torres |
> | 6 | discovery | Vitest is faster than Jest for Vite projects | medium | Data |
>
> **Graduation candidates** (high confidence, potentially generalizable):
> - ✨ "CRA is deprecated — Vite is the modern default" — applies to any React project
> - ✨ "CSS Grid + Tailwind for responsive portfolio layouts" — useful for future UI work
> - ✨ "react-markdown + remark-gfm handles blog content well" — useful for any blog feature

Here's what two of those learning log entries look like in `.squad/learnings/log.jsonl`:

```json
{"id":"learn-1721487300-x7k2m9","ts":"2025-07-20T14:35:00.000Z","type":"discovery","agent":"Torres","domain":"generalizable","tags":["react","build-tools","vite"],"title":"CRA is deprecated — Vite is the modern default","body":"Create React App is no longer maintained. The React team recommends Vite for new projects. Vite offers faster dev server startup, HMR, and native ESM support. Use `npm create vite@latest -- --template react` for new React projects.","confidence":"high","source":"React docs and npm deprecation notice"}
{"id":"learn-1721488200-p3n8q1","ts":"2025-07-20T14:50:00.000Z","type":"technique","agent":"Troi","domain":"generalizable","tags":["css","tailwind","layout","responsive"],"title":"CSS Grid + Tailwind for responsive portfolio layouts","body":"For portfolio sites, a CSS Grid layout with Tailwind utility classes provides the best balance of flexibility and simplicity. Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for project cards. Avoids the complexity of custom media queries.","confidence":"high","source":"Implemented in Projects component, tested across breakpoints"}
```

Alex can graduate these into shared skills on main — so future teams benefit:

```bash
npx tsx scripts/graduate-learning.ts \
  --id learn-1721487300-x7k2m9 \
  --target-skill coding-best-practices
```

Once graduated and synced, every future team starts with that knowledge.

---

## 9. Adding a Second Team (Non-Homogeneous)

A week later, Alex wants to add blog content. This isn't a coding task — it's research.

**Alex:**
I also need a research team to investigate the best blogging platform integration for my React site

> **Copilot:**
>
> Got it. This is a **research** task, not coding. Let me check the archetype...
>
> The coding archetype is already installed, but research is a different work pattern.
>
> ```bash
> copilot plugin install squad-archetype-research@vladi-plugins-marketplace
> ```
>
> ⚠️ `squad-archetype-research` is not yet published. I'll onboard the team using the core federation scaffolding with a custom prompt. The team will work without an archetype-specific playbook — you can install the research archetype later when it's available.
>
> 🏗️ Onboarding team: **Blog Research**
>
> ```
> Creating branch: squad/blog-research from main
> Creating worktree: /Users/alex/alex-portfolio-blog-research
> Scaffolding federation state...
> ✓ Squad initialized
>
> ✅ Team onboarded: Blog Research
>    Worktree: /Users/alex/alex-portfolio-blog-research
>    Branch: squad/blog-research
> ```
>
> 🎬 Team cast for **blog-research**:
>
> | Role | Agent | Specialty |
> |------|-------|-----------|
> | Lead Researcher | **Spock** | Systematic analysis, comparison matrices |
> | Writer | **Uhura** | Technical writing, documentation |
> | Reviewer | **Scotty** | Feasibility assessment, integration concerns |

Now the meta-squad manages two teams of different types. The `federate.config.json` stays the same — archetype binding is per-worktree, not per-federation.

### Final Filesystem Layout

```
/Users/alex/
├── alex-portfolio/                          ← main branch (meta-squad)
│   ├── .squad/
│   │   ├── team.md                          ← Picard, Scribe, Ralph
│   │   ├── skills/                          ← authoritative skill copies
│   │   └── learnings/
│   │       └── log.jsonl                    ← graduated learnings
│   ├── federate.config.json
│   ├── index.html
│   ├── styles.css
│   └── README.md
│
├── alex-portfolio-frontend-redesign/        ← squad/frontend-redesign (coding)
│   ├── .squad/
│   │   ├── team.md                          ← Torres, Troi, Data
│   │   ├── archetype.json                   ← archetype: coding
│   │   ├── launch-prompt.md                 ← from coding archetype
│   │   ├── ceremonies.md
│   │   ├── telemetry.json
│   │   ├── skills/
│   │   ├── learnings/
│   │   │   └── log.jsonl                    ← 6 entries from the redesign
│   │   └── signals/
│   │       ├── status.json                  ← state: complete
│   │       ├── inbox/
│   │       │   └── ...-directive-use-tailwind-css-....json
│   │       └── outbox/
│   │           └── ...-report-react-redesign-complete.json
│   ├── DOMAIN_CONTEXT.md
│   ├── src/                                 ← React app (built by team)
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── Hero.jsx
│   │   │   ├── Projects.jsx
│   │   │   ├── About.jsx
│   │   │   └── Contact.jsx
│   │   ├── pages/
│   │   │   └── Blog.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── run-output.log                       ← session transcript
│
└── alex-portfolio-blog-research/            ← squad/blog-research (research)
    ├── .squad/
    │   ├── team.md                          ← Spock, Uhura, Scotty
    │   ├── ceremonies.md
    │   ├── telemetry.json
    │   ├── skills/
    │   ├── learnings/
    │   │   └── log.jsonl                    ← will fill during research
    │   └── signals/
    │       ├── status.json                  ← state: initializing
    │       ├── inbox/
    │       └── outbox/
    ├── DOMAIN_CONTEXT.md
    └── README.md
```

Git branch layout:

```
main                        ← meta-squad: skills, governance, aggregation
squad/frontend-redesign     ← permanent, complete (PR open to main)
squad/blog-research         ← permanent, just onboarded
```

### Monitoring Both Teams

```
📊 Domain Scan Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 frontend-redesign                 complete     pr: Pull request opened
   Last update: 6d ago
   deliverable.json: ✗   log: ✓

🟡 blog-research                     scanning     explore: CMS options
   Agent: Spock
   Progress: 20%
   Last update: 3m ago
   deliverable.json: ✗   log: ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Recent Learnings:

  [blog-research] [Spock] MDX is the dominant choice for React blog integra...
  [blog-research] [Spock] Contentlayer provides type-safe content for Next....

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Last updated: 3:15:22 PM
```

---

## 10. What Happened Behind the Scenes

Here's a summary of what each layer did throughout this walkthrough:

### Core Layer (squad-federation-core)

The plumbing. It has **zero knowledge** of what the teams produce — only how they operate.

| Operation | What Core Did |
|-----------|---------------|
| **Onboard** | Created git branch, worktree, scaffolded `.squad/signals/`, `.squad/learnings/`, `DOMAIN_CONTEXT.md`, `ceremonies.md`, `telemetry.json` |
| **Launch** | Resolved prompt (4-tier chain), initialized signals, spawned detached Copilot session with MCP servers |
| **Monitor** | Read `status.json` from all worktrees, displayed dashboard, showed recent learnings |
| **Directive** | Wrote JSON message to team's `inbox/` directory |
| **Signals** | File-based IPC: `status.json` (heartbeat), `inbox/` (meta→team), `outbox/` (team→meta) |
| **Knowledge** | Append-only learning log per team, cross-team sweep, graduation to shared skills, sync to all teams |

### Archetype Layer (squad-archetype-coding)

The work pattern. Defines **how** a coding team operates.

| What It Provided | Purpose |
|------------------|---------|
| `.squad/launch-prompt.md` | Prompt template with coding-specific workflow (design → implement → test → PR) |
| Playbook skill | Step-by-step guide for the team's coding workflow |
| Cleanup hook | Clears build artifacts on `--reset` |

A different archetype (research, deliverable, task) would provide a different prompt template, playbook, and cleanup behavior — but core's operations work identically regardless.

### Squad Layer (the foundation)

| What Squad Provided | Purpose |
|---------------------|---------|
| `squad.agent.md` | Coordinator agent that orchestrates the team |
| Casting system | Selected agents from Star Trek universe matching team roles |
| Agent framework | Individual agent identities, histories, charters |
| `squad init` | Initialized `.squad/` directory in each worktree |

### How Signals Flow

```
┌─────────────────────────────────────────────────────────┐
│                  META-SQUAD (main)                       │
│                                                         │
│  Picard reads status.json ──────── from each worktree   │
│  Picard sends directives  ──────── to inbox/            │
│  Picard reads reports     ──────── from outbox/         │
│  Picard sweeps learnings  ──────── from learnings/      │
│  Picard graduates skills  ──────── to .squad/skills/    │
│  Picard syncs skills      ──────── to all worktrees     │
│                                                         │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│ frontend-redesign│   │  blog-research   │
│                  │   │                  │
│ Torres writes    │   │ Spock writes     │
│  status.json     │   │  status.json     │
│  outbox/ reports │   │  outbox/ reports │
│  learnings/      │   │  learnings/      │
│                  │   │                  │
│ Torres reads     │   │ Spock reads      │
│  inbox/          │   │  inbox/          │
└──────────────────┘   └──────────────────┘
```

### How Knowledge Flows

```
                ┌────────────────────────┐
                │     MAIN (skills/)     │
                │                        │
           ┌────┤  Authoritative copies  ├────┐
           │    │  of all shared skills  │    │
           │    └───────────▲────────────┘    │
           │                │                 │
     SEED (onboard)    GRADUATE           SYNC (periodic)
           │          (learning→skill)        │
           │                │                 │
           ▼                │                 ▼
   ┌───────────┐    ┌──────┴──────┐   ┌───────────┐
   │ Team A    │    │  sweep +    │   │ Team B    │
   │ skills/   │    │  graduate   │   │ skills/   │
   │ learnings/│────┤  scripts    ├───│ learnings/│
   └───────────┘    └─────────────┘   └───────────┘
```

1. **Seed** — New team inherits all skills from main at onboarding
2. **Sync** — Updated skills on main are pushed to existing teams
3. **Graduate** — Team learnings (validated, cross-domain) become shared skills

---

## Quick Reference: Commands

| What | Command |
|------|---------|
| Onboard a team | `npx tsx scripts/onboard.ts --name my-team --domain-id my-team` |
| Launch a team | `npx tsx scripts/launch.ts --team my-team` |
| Launch all teams | `npx tsx scripts/launch.ts --all` |
| Relaunch (clean) | `npx tsx scripts/launch.ts --team my-team --reset` |
| Run one step | `npx tsx scripts/launch.ts --team my-team --step implement` |
| Monitor (once) | `npx tsx scripts/monitor.ts` |
| Monitor (watch) | `npx tsx scripts/monitor.ts --watch --interval 30` |
| Send directive | `npx tsx scripts/monitor.ts --send my-team --directive "Do X"` |
| Sync skills | `npx tsx scripts/sync-skills.ts` |
| Sweep learnings | `npx tsx scripts/sweep-learnings.ts` |
| Graduate learning | `npx tsx scripts/graduate-learning.ts --id learn-xxx --target-skill y` |
| Query learnings | `npx tsx scripts/query-learnings.ts --type pattern --confidence high` |
| OTel dashboard | `npx tsx scripts/dashboard.ts` |

---

## Key Principles

1. **Domain branches never merge back** — Knowledge flows via signals, learnings, and graduation. PRs go from team branch → main through code review, not git merge.

2. **One writer per file** — `status.json` is written only by the team. `inbox/` is written only by meta-squad. `outbox/` is written only by the team. No race conditions.

3. **Archetypes are swappable** — Core works identically whether the team is coding, researching, or producing deliverables. The archetype defines the work pattern; core defines the operating model.

4. **Knowledge compounds** — Each team's learnings can graduate into shared skills. The federation gets smarter over time. A team onboarded next month starts with everything graduated so far.

5. **Worktrees are cheap** — Git worktrees share the object store. Ten teams don't consume 10× the disk. They're just independent working directories pointing at different branches.

---

*For the full architecture reference, see [ARCHITECTURE.md](./ARCHITECTURE.md).*
*For plugin API and configuration, see [README.md](./README.md).*
