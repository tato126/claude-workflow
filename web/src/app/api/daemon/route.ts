import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const WORKFLOW_DIR = join(process.env.HOME || '', '.claude', 'workflow');
const LOCK_FILE = join(WORKFLOW_DIR, 'daemon.lock');

export async function GET() {
  try {
    if (!existsSync(LOCK_FILE)) {
      return NextResponse.json({ running: false });
    }

    const pid = parseInt(readFileSync(LOCK_FILE, 'utf-8').trim());

    try {
      process.kill(pid, 0);
      return NextResponse.json({ running: true, pid });
    } catch {
      return NextResponse.json({ running: false });
    }
  } catch (error) {
    return NextResponse.json({ running: false });
  }
}

export async function POST() {
  try {
    // Check if already running
    if (existsSync(LOCK_FILE)) {
      const pid = parseInt(readFileSync(LOCK_FILE, 'utf-8').trim());
      try {
        process.kill(pid, 0);
        return NextResponse.json({ error: 'Daemon already running' }, { status: 400 });
      } catch {
        // Process not running, continue
      }
    }

    // Start daemon
    const daemonDir = join(WORKFLOW_DIR, 'daemon');
    const logFile = join(WORKFLOW_DIR, 'logs', 'daemon.log');

    await execAsync(`cd "${daemonDir}" && npm run dev > "${logFile}" 2>&1 & echo $!`, {
      shell: '/bin/bash',
    }).then(({ stdout }) => {
      const pid = stdout.trim();
      writeFileSync(LOCK_FILE, pid);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to start daemon' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (!existsSync(LOCK_FILE)) {
      return NextResponse.json({ error: 'Daemon not running' }, { status: 400 });
    }

    const pid = parseInt(readFileSync(LOCK_FILE, 'utf-8').trim());

    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already dead
    }

    await execAsync(`rm -f "${LOCK_FILE}"`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to stop daemon' }, { status: 500 });
  }
}
