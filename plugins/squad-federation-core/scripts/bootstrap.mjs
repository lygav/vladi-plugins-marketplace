#!/usr/bin/env node
/**
 * Bootstrap script — ensures plugin dependencies are installed.
 * Run this before any other script. Idempotent — safe to run multiple times.
 * 
 * Usage: node scripts/bootstrap.mjs
 * 
 * What it does:
 * 1. Checks if node_modules exists at plugin root
 * 2. Runs npm install if missing
 * 3. Validates critical dependencies are loadable
 * 4. Sets up OTel endpoint from federate.config.json if available
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pluginRoot = resolve(__dirname, '..');

function bootstrap() {
  // 1. Check/install node_modules
  const nodeModules = resolve(pluginRoot, 'node_modules');
  if (!existsSync(nodeModules)) {
    console.log('📦 Installing dependencies...');
    execSync('npm install', { cwd: pluginRoot, stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  }

  // 2. Validate critical deps (ESM-compatible check)
  const zodPath = resolve(pluginRoot, 'node_modules', 'zod');
  if (!existsSync(zodPath)) {
    console.log('📦 Dependencies incomplete, reinstalling...');
    execSync('npm install', { cwd: pluginRoot, stdio: 'inherit' });
  }

  // 3. Set OTel endpoint from config if available
  const configPath = resolve(process.cwd(), 'federate.config.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (config.telemetry?.endpoint && !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT = config.telemetry.endpoint;
        console.log(`📊 OTel endpoint: ${config.telemetry.endpoint}`);
      }
    } catch {}
  }

  console.log('✅ Bootstrap complete');
}

bootstrap();
