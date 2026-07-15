import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import type { CandidateProblem } from '$lib/codegate/types';
import { generateExactMarker } from '../codegate/exact-marker.mjs';
import { officialTests } from '../codegate/test-vectors.mjs';

const ordinaryRoot = path.resolve(process.env.CODEGATE_APP_ROOT || process.cwd(), 'problems');
const runtimeRoot = path.resolve(process.env.CODEGATE_RUNTIME_PACK_ROOT || path.join(os.tmpdir(), `codegate-runtime-${process.pid}`));
let activeGenerated: { slug: string; hash: string } | undefined;
let materialization = Promise.resolve();

process.once('exit', () => {
    try { fsSync.rmSync(runtimeRoot, { recursive: true, force: true }); } catch { /* best-effort temporary cleanup */ }
});

function safeChild(root: string, ...parts: string[]): string {
    const target = path.resolve(root, ...parts);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Problem path escapes its root');
    return target;
}

export function resolveProblemFile(problemId: string, fileName: string): string {
    const overlay = safeChild(runtimeRoot, problemId, fileName);
    if (activeGenerated?.slug === problemId) return overlay;
    return safeChild(ordinaryRoot, problemId, fileName);
}

function statement(record: Record<string, any>): string {
    const constraints = (record.constraints ?? []).map((value: unknown) => `- ${String(value)}`).join('\n');
    const followups = (record.follow_ups ?? []).map((value: unknown) => `- ${String(value)}`).join('\n');
    return `# ${record.frontend_id}. ${record.title}\n\n${record.description ?? ''}\n\n${constraints ? `## Constraints\n\n${constraints}\n\n` : ''}${followups ? `## Follow-ups\n\n${followups}\n` : ''}`;
}

export async function materializeGeneratedProblem(problem: CandidateProblem, record: Record<string, any>, cases: Array<{ input: Record<string, unknown>; output: unknown }>): Promise<void> {
    if (!problem.judge) return;
    materialization = materialization.then(async () => {
        if (activeGenerated?.slug === problem.slug && activeGenerated.hash === problem.judgeSha256) return;
        await fs.rm(runtimeRoot, { recursive: true, force: true });
        const target = safeChild(runtimeRoot, problem.slug);
        await fs.mkdir(target, { recursive: true });
        const tests = officialTests(cases, problem.judge!.metadata as any);
        const metadata = { ...problem.judge!.metadata, testCases: tests.slice(0, 3) };
        await Promise.all([
            fs.writeFile(path.join(target, 'metadata.json'), `${JSON.stringify(metadata)}\n`),
            fs.writeFile(path.join(target, 'official-tests.json'), `${JSON.stringify(tests)}\n`),
            fs.writeFile(path.join(target, 'Marker.java'), generateExactMarker(problem.judge!.metadata as any, cases)),
            fs.writeFile(path.join(target, 'statement.md'), statement(record))
        ]);
        activeGenerated = { slug: problem.slug, hash: problem.judgeSha256 };
    });
    return materialization;
}

export async function deactivateGeneratedProblem(): Promise<void> {
    materialization = materialization.then(async () => {
        if (!activeGenerated) return;
        await fs.rm(runtimeRoot, { recursive: true, force: true });
        activeGenerated = undefined;
    });
    return materialization;
}
