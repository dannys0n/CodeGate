import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CppRunner } from '../../src/lib/runners/CppRunner';
import { PythonRunner } from '../../src/lib/runners/PythonRunner';
import { loadCandidateAssets } from '../../src/lib/server/codegate/catalog';
import { resolveProblemFile } from '../../src/lib/server/problem-files';
import { bridgeProblems } from './bridge-problems.mjs';

const integrationDescribe = process.env.CODEGATE_BRIDGE_INTEGRATION === '1' ? describe : describe.skip;

function parsedResults(chunks: string[]): unknown[] {
    return chunks.map((chunk) => {
        const line = chunk.split(/\r?\n/).find((candidate) => candidate.startsWith(':::RESULT:::'));
        if (!line) throw new Error(`Runner result was missing: ${chunk}`);
        return JSON.parse(line.slice(':::RESULT:::'.length));
    });
}

integrationDescribe('CodeGate bridge reference solutions', () => {
    for (const language of ['python', 'cpp'] as const) {
        it(`passes every official case in ${language}`, async () => {
            for (const problem of bridgeProblems) {
                const assets = await loadCandidateAssets(String(problem.number), language);
                const tests = JSON.parse(await fs.readFile(resolveProblemFile(problem.slug, 'official-tests.json'), 'utf8'));
                const runner = language === 'python'
                    ? new PythonRunner(problem.slug, tests, assets.solution)
                    : new CppRunner(problem.slug, tests, assets.solution);
                await runner.compile();
                expect(parsedResults(await runner.run()), problem.slug)
                    .toEqual(problem.cases.map((testCase) => testCase.output));
            }
        }, 300_000);
    }
});

