import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.env.HOME || '', '.claude', 'workflow', 'data');

export async function GET() {
  try {
    const registry = JSON.parse(
      readFileSync(join(DATA_DIR, 'registry.json'), 'utf-8')
    );
    return NextResponse.json(registry.projects);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read registry' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, path } = await request.json();
    const registryPath = join(DATA_DIR, 'registry.json');
    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));

    const exists = registry.projects.some((p: { path: string }) => p.path === path);
    if (exists) {
      return NextResponse.json({ error: 'Project already exists' }, { status: 400 });
    }

    registry.projects.push({
      name,
      path,
      addedAt: new Date().toISOString(),
    });

    writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add project' }, { status: 500 });
  }
}
