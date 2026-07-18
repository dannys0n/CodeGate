import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import type { CandidateProblem } from '$lib/codegate/types';
import { generateExactMarker } from '../codegate/exact-marker.mjs';
import { officialTests } from '../codegate/test-vectors.mjs';

const ordinaryRoot = path.resolve(process.env.CODEGATE_APP_ROOT || process.cwd(), 'problems');
const runtimeRoot = path.resolve(process.env.CODEGATE_RUNTIME_PACK_ROOT || path.join(os.tmpdir(), `codegate-runtime-${process.pid}`));
const activeGenerated = new Map<string, string>();
let activeCatalogProblemId: string | undefined;
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
    if (activeGenerated.has(problemId)) return overlay;
    return safeChild(ordinaryRoot, problemId, fileName);
}

function statement(record: Record<string, any>): string {
    const constraints = (record.constraints ?? []).map((value: unknown) => `- ${String(value)}`).join('\n');
    const followups = (record.follow_ups ?? []).map((value: unknown) => `- ${String(value)}`).join('\n');
    return `${record.description ?? ''}\n\n${constraints ? `## Constraints\n\n${constraints}\n\n` : ''}${followups ? `## Follow-ups\n\n${followups}\n` : ''}`;
}

export async function materializeGeneratedProblem(problem: CandidateProblem, record: Record<string, any>, cases: Array<{ input: Record<string, unknown>; output: unknown }>): Promise<void> {
    if (!problem.judge) return;
    materialization = materialization.then(async () => {
        if (activeGenerated.get(problem.slug) === problem.judgeSha256) return;
        if (activeCatalogProblemId && activeCatalogProblemId !== problem.slug) {
            await fs.rm(safeChild(runtimeRoot, activeCatalogProblemId), { recursive: true, force: true });
            activeGenerated.delete(activeCatalogProblemId);
        }
        const target = safeChild(runtimeRoot, problem.slug);
        await fs.rm(target, { recursive: true, force: true });
        await fs.mkdir(target, { recursive: true });
        const tests = officialTests(cases, problem.judge!.metadata as any);
        const metadata = { ...problem.judge!.metadata, testCases: tests.slice(0, 3) };
        await Promise.all([
            fs.writeFile(path.join(target, 'metadata.json'), `${JSON.stringify(metadata)}\n`),
            fs.writeFile(path.join(target, 'official-tests.json'), `${JSON.stringify(tests)}\n`),
            fs.writeFile(path.join(target, 'Marker.java'), generateExactMarker(problem.judge!.metadata as any, cases)),
            fs.writeFile(path.join(target, 'statement.md'), statement(record))
        ]);
        activeGenerated.set(problem.slug, problem.judgeSha256);
        activeCatalogProblemId = problem.slug;
    });
    return materialization;
}

export async function materializeRuntimeProblem(
    problemId: string,
    revision: string,
    metadata: Record<string, any>
): Promise<void> {
    materialization = materialization.then(async () => {
        if (activeGenerated.get(problemId) === revision) return;
        const target = safeChild(runtimeRoot, problemId);
        await fs.rm(target, { recursive: true, force: true });
        await fs.mkdir(target, { recursive: true });
        await fs.writeFile(path.join(target, 'metadata.json'), `${JSON.stringify(metadata)}\n`);
        activeGenerated.set(problemId, revision);
    });
    return materialization;
}

export async function deactivateGeneratedProblem(problemId?: string): Promise<void> {
    materialization = materialization.then(async () => {
        if (problemId) {
            await fs.rm(safeChild(runtimeRoot, problemId), { recursive: true, force: true });
            activeGenerated.delete(problemId);
            if (activeCatalogProblemId === problemId) activeCatalogProblemId = undefined;
            return;
        }
        await fs.rm(runtimeRoot, { recursive: true, force: true });
        activeGenerated.clear();
        activeCatalogProblemId = undefined;
    });
    return materialization;
}
