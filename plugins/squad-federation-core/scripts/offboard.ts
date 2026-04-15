#!/usr/bin/env tsx
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as readline from "readline";
import { execSync } from "child_process";
import { TeamRegistry } from "./lib/registry/team-registry.js";
import { OTelEmitter } from "../sdk/otel-emitter.js";

const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();

type OffboardMode = "retire" | "pause" | "resume";
type OutputFormat = "text" | "json";

interface ParsedArgs { team: string | null; mode: OffboardMode; force: boolean; nonInteractive: boolean; outputFormat: OutputFormat; }
interface OffboardResult { success: boolean; team: string; mode: OffboardMode; message: string; details: Record<string, unknown>; }

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const p: ParsedArgs = { team: null, mode: "retire", force: false, nonInteractive: false, outputFormat: "text" };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--team": p.team = args[++i]; break;
      case "--mode": p.mode = args[++i] as OffboardMode; break;
      case "--force": p.force = true; break;
      case "--non-interactive": p.nonInteractive = true; break;
      case "--output-format": p.outputFormat = args[++i] as OutputFormat; break;
    }
  }
  return p;
}

function output(r: OffboardResult, f: OutputFormat): void {
  if (f === "json") console.log(JSON.stringify(r, null, 2));
  else console.log(r.success ? `\n✅ ${r.message}` : `\n❌ ${r.message}`);
}

async function confirm(prompt: string, ni: boolean, force: boolean): Promise<boolean> {
  if (force || ni) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question(`${prompt} (y/N): `, (a) => { rl.close(); resolve(a.toLowerCase() === "y"); }); });
}

async function graduateLearnings(loc: string): Promise<number> {
  const src = path.join(loc, ".squad", "learnings");
  const dst = path.join(REPO_ROOT, ".squad", "learnings");
  if (!fs.existsSync(src)) return 0;
  await fsp.mkdir(dst, { recursive: true });
  let c = 0;
  for (const f of await fsp.readdir(src)) {
    if (!f.endsWith(".jsonl") && !f.endsWith(".json") && !f.endsWith(".md")) continue;
    const d = path.join(dst, f);
    if (!fs.existsSync(d)) { await fsp.copyFile(path.join(src, f), d); c++; }
  }
  return c;
}

async function archiveSignals(loc: string): Promise<number> {
  const inbox = path.join(loc, ".squad", "signals", "inbox");
  const outbox = path.join(loc, ".squad", "signals", "outbox");
  const archive = path.join(loc, ".squad", "archived-signals");
  if (!fs.existsSync(inbox) && !fs.existsSync(outbox)) return 0;
  await fsp.mkdir(archive, { recursive: true });
  let c = 0;
  for (const dir of [inbox, outbox]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of await fsp.readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      await fsp.copyFile(path.join(dir, f), path.join(archive, `${path.basename(dir)}-${f}`));
      c++;
    }
  }
  return c;
}

function removeWorktree(loc: string): boolean {
  try { execSync(`git worktree remove --force "${loc}"`, { cwd: REPO_ROOT, stdio: "pipe" }); return true; }
  catch { return false; }
}

async function retireTeam(reg: TeamRegistry, name: string, args: ParsedArgs, emit: OTelEmitter): Promise<OffboardResult> {
  const t = await reg.get(name);
  if (!t) return { success: false, team: name, mode: "retire", message: `Team "${name}" not found`, details: {} };
  if ((t.status ?? "active") === "retired") return { success: false, team: name, mode: "retire", message: `Team "${name}" is already retired`, details: {} };
  if (!args.force && !args.nonInteractive && !await confirm(`Retire "${name}"?`, args.nonInteractive, args.force))
    return { success: false, team: name, mode: "retire", message: "Cancelled", details: {} };
  const details: Record<string, unknown> = {};
  details.learningsGraduated = await graduateLearnings(t.location);
  details.signalsArchived = await archiveSignals(t.location);
  await reg.updateStatus(name, "retired");
  details.statusUpdated = true;
  if ((t.placementType ?? "worktree") === "worktree" && fs.existsSync(t.location)) details.worktreeRemoved = removeWorktree(t.location);
  await emit.event("team.retired", { "squad.domain": t.domain, "domain.id": t.domainId });
  return { success: true, team: name, mode: "retire", message: `Team "${name}" retired successfully`, details };
}

async function pauseTeam(reg: TeamRegistry, name: string, _: ParsedArgs, emit: OTelEmitter): Promise<OffboardResult> {
  const t = await reg.get(name);
  if (!t) return { success: false, team: name, mode: "pause", message: `Team "${name}" not found`, details: {} };
  if ((t.status ?? "active") !== "active") return { success: false, team: name, mode: "pause", message: `Team "${name}" cannot be paused (${t.status ?? "active"})`, details: {} };
  await reg.updateStatus(name, "paused");
  await emit.event("team.paused", { "squad.domain": t.domain, "domain.id": t.domainId });
  return { success: true, team: name, mode: "pause", message: `Team "${name}" paused`, details: { pausedAt: new Date().toISOString() } };
}

async function resumeTeam(reg: TeamRegistry, name: string, _: ParsedArgs, emit: OTelEmitter): Promise<OffboardResult> {
  const t = await reg.get(name);
  if (!t) return { success: false, team: name, mode: "resume", message: `Team "${name}" not found`, details: {} };
  if ((t.status ?? "active") !== "paused") return { success: false, team: name, mode: "resume", message: `Team "${name}" cannot be resumed (${t.status ?? "active"})`, details: {} };
  await reg.updateStatus(name, "active");
  await emit.event("team.resumed", { "squad.domain": t.domain, "domain.id": t.domainId });
  return { success: true, team: name, mode: "resume", message: `Team "${name}" resumed`, details: { resumedAt: new Date().toISOString() } };
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.team) { console.error("Usage: npx tsx scripts/offboard.ts --team <name> --mode retire|pause|resume"); process.exit(1); }
  if (!["retire", "pause", "resume"].includes(args.mode)) { console.error(`Invalid mode: ${args.mode}`); process.exit(1); }
  const emit = new OTelEmitter();
  const reg = new TeamRegistry(REPO_ROOT, emit);
  let r: OffboardResult;
  switch (args.mode) {
    case "retire": r = await retireTeam(reg, args.team, args, emit); break;
    case "pause": r = await pauseTeam(reg, args.team, args, emit); break;
    case "resume": r = await resumeTeam(reg, args.team, args, emit); break;
  }
  output(r, args.outputFormat);
  if (!r.success) process.exit(1);
}

main().catch((e) => { console.error(`Offboard failed: ${(e as Error).message}`); process.exit(1); });
