---
title: Creating Archetypes
description: How to design and implement custom archetypes
---

# Creating Archetypes

This guide walks through creating a custom archetype for Squad Federation.

## Overview

An archetype defines:
1. **Lifecycle states** - Valid phases a team can be in
2. **Skills** - Knowledge base for the team
3. **Agents** (optional) - Specialized sub-agents
4. **Monitors** (optional) - Custom health checks

## Step-by-Step Guide

### Step 1: Plan Your Archetype

**Questions to answer:**

1. **What is the team's purpose?**
   - Example: "Deploy infrastructure changes"

2. **What states will the team go through?**
   - Example: `planning → provisioning → testing → deploying → complete`

3. **What skills does the team need?**
   - Example: Terraform best practices, AWS conventions

4. **What agents are needed?**
   - Example: Planner (high-level), Executor (applies changes)

5. **What should monitoring check?**
   - Example: Terraform plan success, resource count

### Step 2: Create Directory Structure

```bash
mkdir -p archetypes/plugins/my-archetype/team/{agents,skills,monitors}
```

**Result:**
```
archetypes/plugins/my-archetype/
├── archetype.json
└── team/
    ├── agents/
    ├── skills/
    └── monitors/
```

### Step 3: Write Archetype Config

**File:** `archetypes/plugins/my-archetype/archetype.json`

```json
{
  "archetypeId": "infrastructure",
  "name": "Infrastructure Team",
  "states": [
    "initializing",
    "planning",
    "provisioning",
    "testing",
    "deploying",
    "complete",
    "failed",
    "paused"
  ],
  "skills": [
    "team/skills/terraform-conventions.md",
    "team/skills/aws-best-practices.md"
  ]
}
```

**Fields:**

- `archetypeId` - Unique identifier (matches directory name)
- `name` - Display name
- `states` - All valid lifecycle states
- `skills` - Paths to skill files (relative to archetype dir)

### Step 4: Define States

States should reflect your team's workflow.

**Linear workflow:**
```
initializing → planning → provisioning → testing → deploying → complete
```

**State transitions:**
- `planning` can go to `provisioning` or `paused`
- `provisioning` can go to `testing`, `failed`, or `paused`
- Any state can go to `failed`

**State descriptions:**

| State | Description | Next States |
|-------|-------------|-------------|
| `initializing` | Team starting up | `planning` |
| `planning` | Creating Terraform plan | `provisioning`, `paused` |
| `provisioning` | Applying infrastructure | `testing`, `failed`, `paused` |
| `testing` | Validating resources | `deploying`, `failed`, `paused` |
| `deploying` | Finalizing deployment | `complete`, `failed` |
| `complete` | Successfully deployed | (terminal) |
| `failed` | Error occurred | (terminal) |
| `paused` | Manually paused | (any previous) |

### Step 5: Create Skills

**File:** `team/skills/terraform-conventions.md`

```markdown
---
tags: [terraform, infrastructure, conventions]
category: convention
---

# Terraform Conventions

Follow these standards for Terraform code.

## File Organization

```
terraform/
├── main.tf          ← Resources
├── variables.tf     ← Input variables
├── outputs.tf       ← Output values
├── versions.tf      ← Provider versions
└── terraform.tfvars ← Values (gitignored)
```

## Naming

- **Resources:** `{type}_{name}` (e.g., `aws_s3_bucket_logs`)
- **Variables:** kebab-case (e.g., `log-bucket-name`)
- **Modules:** kebab-case directories

## State Management

- Store state in S3 with locking (DynamoDB)
- Never commit `.tfstate` files
- Use workspaces for environments

## Best Practices

1. Pin provider versions in `versions.tf`
2. Use `terraform fmt` before commit
3. Run `terraform validate` in CI
4. Document outputs in comments
```

**File:** `team/skills/aws-best-practices.md`

```markdown
---
tags: [aws, infrastructure, security]
category: pattern
---

# AWS Best Practices

Security and cost guidelines for AWS resources.

## Security

**IAM:**
- Use least-privilege policies
- No hardcoded credentials
- Enable MFA for human users

**Encryption:**
- Enable encryption at rest (S3, EBS, RDS)
- Use KMS for key management
- Enable SSL/TLS for data in transit

**Networking:**
- Use VPCs with private subnets
- Restrict security group ingress
- Enable VPC Flow Logs

## Cost Optimization

- Tag all resources (`Environment`, `Project`, `Owner`)
- Use Reserved Instances for steady workloads
- Set up billing alerts
- Delete unused resources (snapshots, volumes)

## Monitoring

- Enable CloudWatch alarms
- Set up SNS notifications
- Use CloudTrail for audit logs
```

### Step 6: Create Agents (Optional)

**File:** `team/agents/planner.md`

```markdown
---
name: Planner
temperature: 0.1
description: Infrastructure planning specialist
tools: [bash, view, grep]
---

You are the planner for an infrastructure team. Your role:

1. **Review requirements** - Understand what needs to be deployed
2. **Create Terraform plan** - Write `.tf` files or modify existing
3. **Validate syntax** - Run `terraform validate`
4. **Generate plan** - Run `terraform plan` and review output
5. **Document changes** - Summarize what will be created/modified/destroyed

**Guidelines:**
- Follow Terraform conventions (see skills)
- Apply AWS best practices (see skills)
- Ask questions if requirements are unclear
- Delegate execution to Executor agent

**Output:**
Terraform files and plan summary in `deliverable.md`.
```

**File:** `team/agents/executor.md`

```markdown
---
name: Executor
temperature: 0.0
description: Infrastructure deployment specialist
tools: [bash]
---

You are the executor for an infrastructure team. Your role:

1. **Apply Terraform plan** - Run `terraform apply`
2. **Monitor progress** - Watch for errors
3. **Validate deployment** - Check resources exist
4. **Update status** - Report success or failures

**Guidelines:**
- Only execute if plan was reviewed by Planner
- Halt on errors and report immediately
- Capture Terraform output for audit
- Do not make unplanned changes

**Safety:**
- Always review plan before applying
- Use `-auto-approve` only if explicitly directed
- Back up state before major changes
```

### Step 7: Create Monitor (Optional)

**File:** `team/monitors/infrastructure-monitor.ts`

```typescript
import { MonitorBase, MonitorResult } from '@squad/sdk';

export class InfrastructureMonitor extends MonitorBase {
  async monitor(teamId: string): Promise<MonitorResult> {
    const status = await this.readStatus(teamId);
    
    // Check if Terraform plan exists
    const hasPlan = await this.fileExists(teamId, 'terraform/main.tf');
    if (!hasPlan && status.state === 'provisioning') {
      this.logWarn('No Terraform files found but state is provisioning');
      return {
        health: 'error',
        message: 'Missing Terraform configuration'
      };
    }
    
    // Check if state is stale
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const updated = new Date(status.updated_at);
    const now = new Date();
    if (now.getTime() - updated.getTime() > staleThreshold) {
      this.logWarn(`Status not updated in 10+ minutes`);
      return {
        health: 'warning',
        message: 'Team may be stalled'
      };
    }
    
    // Emit metrics
    this.emitMetrics('infra.state', 1, {
      domain: teamId,
      state: status.state
    });
    
    return {
      health: 'healthy',
      message: 'Infrastructure team operating normally'
    };
  }
}
```

### Step 8: Register Archetype

**File:** `archetypes/archetype.json`

Add your archetype to the root manifest:

```json
{
  "archetypes": {
    "coding": { ... },
    "deliverable": { ... },
    "consultant": { ... },
    "infrastructure": {
      "path": "./plugins/my-archetype",
      "archetypeJson": "./plugins/my-archetype/archetype.json"
    }
  }
}
```

### Step 9: Test Onboarding

```bash
npx tsx scripts/onboard.ts \
  --domain infra-team \
  --mission "Deploy AWS infrastructure" \
  --archetype infrastructure \
  --placement worktree \
  --branch squad/infra
```

**Verify:**

1. Team appears in registry:
   ```bash
   cat .squad/teams.json | jq '.teams[] | select(.domain == "infra-team")'
   ```

2. Archetype files copied:
   ```bash
   ls .worktrees/infra-team/team/skills/
   ```

3. Launch works:
   ```bash
   npx tsx scripts/launch.ts --team infra-team
   ```

## Best Practices

### State Design

**Keep states meaningful:**
- ✅ `provisioning` (clear action)
- ❌ `doing-stuff` (vague)

**Limit state count:**
- Aim for 5-10 states
- Too many states = complex state machine
- Too few states = not enough granularity

**Terminal states:**
- Always include `complete` and `failed`
- These are terminal (no transitions out)

### Skill Design

**One skill per file:**
- Don't combine unrelated topics
- Example: `terraform-conventions.md` and `aws-best-practices.md` (separate)

**Use frontmatter tags:**
```markdown
---
tags: [terraform, infrastructure, conventions]
category: convention
---
```

**Include examples:**
- Code snippets
- Command-line usage
- Real-world scenarios

### Agent Design

**Single responsibility:**
- Each agent should have a clear role
- Planner = plan, Executor = execute

**Tool access:**
- Give agents minimal tools needed
- Planner: `[view, grep]` (read-only)
- Executor: `[bash]` (execution)

**Instructions:**
- Be specific about agent's role
- Reference skills for guidelines
- Provide safety guardrails

### Monitor Design

**Check critical conditions:**
- Required files exist
- State is recent (not stale)
- Progress is being made

**Emit useful metrics:**
- State transitions
- Resource counts
- Error rates

**Return actionable messages:**
- ✅ "Missing Terraform configuration"
- ❌ "Something is wrong"

## Common Pitfalls

### Invalid State Transitions

**Problem:** Archetype defines states but doesn't validate transitions

**Solution:** Document valid transitions in archetype README:

```markdown
## State Machine

initializing → planning → provisioning → testing → deploying → complete
                ↓            ↓            ↓           ↓
              paused       paused       paused      paused
                ↓            ↓            ↓           ↓
              failed       failed       failed      failed
```

### Missing Skills

**Problem:** Skills not copied to team workspace

**Solution:** Ensure skills are listed in `archetype.json` and paths are relative:

```json
{
  "skills": [
    "team/skills/terraform-conventions.md"  // ✅ Relative path
  ]
}
```

### Agent Tool Mismatch

**Problem:** Agent needs tools not listed in frontmatter

**Solution:** Add required tools:

```markdown
---
tools: [bash, view, edit]  // ← Add missing tools
---
```

## Next Steps

- [View built-in archetypes (coding, deliverable, consultant)](/archetypes/coding)
- [Understand archetype overview](/archetypes/overview)
- [Configure federation](/reference/configuration)
