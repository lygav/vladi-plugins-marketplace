#!/usr/bin/env tsx
/**
 * Dashboard — Start/stop Aspire OTel dashboard
 *
 * Delegates to `squad aspire` for the .NET Aspire dashboard container.
 * Maps host ports 4317 (gRPC) → container 18889, 4318 (HTTP) → container 18890.
 */

import { execSync, spawn } from 'child_process';

const command = process.argv[2] || 'start';

function startDashboard(): void {
  console.log('🔭 Starting Aspire OTel dashboard...');
  console.log('   Dashboard: http://localhost:18888');
  console.log('   OTLP gRPC: localhost:4317 → container:18889');
  console.log('   OTLP HTTP: localhost:4318 → container:18890');
  console.log('');

  try {
    // Check if Docker is running
    execSync('docker info', { stdio: 'pipe' });
  } catch {
    console.error('❌ Docker is not running. Start Docker Desktop first.');
    process.exit(1);
  }

  // Use squad aspire if available, otherwise run docker directly
  try {
    execSync('which squad', { stdio: 'pipe' });
    console.log('Using `squad aspire` to start dashboard...');
    const child = spawn('squad', ['aspire'], { stdio: 'inherit' });
    child.on('error', () => {
      console.log('Falling back to direct Docker command...');
      startDockerDirectly();
    });
  } catch {
    startDockerDirectly();
  }
}

function startDockerDirectly(): void {
  const child = spawn('docker', [
    'run', '-d',
    '--name', 'squad-aspire',
    '-p', '18888:18888',
    '-p', '4317:18889',
    '-p', '4318:18890',
    '-e', 'DASHBOARD__FRONTEND__AUTHMODE=Unsecured',
    'mcr.microsoft.com/dotnet/aspire-dashboard:latest',
  ], { stdio: 'inherit' });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Aspire dashboard started at http://localhost:18888');
    } else {
      console.error('❌ Failed to start Aspire dashboard');
    }
  });
}

function stopDashboard(): void {
  console.log('Stopping Aspire dashboard...');
  try {
    execSync('docker stop squad-aspire && docker rm squad-aspire', { stdio: 'pipe' });
    console.log('✅ Dashboard stopped');
  } catch {
    console.log('Dashboard was not running');
  }
}

if (command === 'start') startDashboard();
else if (command === 'stop') stopDashboard();
else console.error(`Unknown command: ${command}. Use 'start' or 'stop'.`);
