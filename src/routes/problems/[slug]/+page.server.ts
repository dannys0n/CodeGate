import fs from 'fs/promises';
import path from 'path';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadPlayableManifest, loadVariantSource } from '$lib/server/codegate/catalog';
import { requireActiveChallenge } from '$lib/server/codegate/sessions';

export const load: PageServerLoad = async ({ params, url }) => {
    try {
        const baseDir = path.resolve('problems', params.slug);
        const problemPath = path.join(baseDir, 'metadata.json');
        const content = await fs.readFile(problemPath, 'utf-8');
        const problem = JSON.parse(content);

        // Load statement.md if present and attach as problem.statement
        const statementPath = path.join(baseDir, 'statement.md');
        try {
            const statementMd = await fs.readFile(statementPath, 'utf-8');
            // Preserve compatibility with the Svelte page expecting problem.statement
            problem.statement = statementMd;
        } catch {
            // If missing, default to empty string
            problem.statement = '';
        }

        // Load solution.md if present and attach as problem.solution
        const solutionPath = path.join(baseDir, 'solution.md');
        try {
            const solutionMd = await fs.readFile(solutionPath, 'utf-8');
            problem.solution = solutionMd;
        } catch {
            problem.solution = null;
        }

        // Normalize hints to an array of strings to ensure UI always works consistently
        if (Array.isArray(problem.hints)) {
            problem.hints = problem.hints.map((h: unknown) => String(h));
        } else if (typeof problem.hints === 'string' && problem.hints.trim().length > 0) {
            problem.hints = [problem.hints.trim()];
        } else {
            problem.hints = [];
        }

        if (url.searchParams.get('codegate') !== '1') return { problem, codegate: null };

        const session = requireActiveChallenge(url.searchParams.get('sessionId') ?? '', url.searchParams.get('challengeId') ?? '');
        const manifest = await loadPlayableManifest();
        const problemVariants = manifest.variants.filter((variant) => variant.problemId === params.slug);
        const selected = session.challenge.variant;
        if (selected.problemId !== params.slug) throw error(409, 'Gate challenge does not match this problem');
        if (!selected) throw error(404, 'No validated CodeGate variant for this problem and language');

        return {
            problem,
            codegate: {
                selected,
                source: await loadVariantSource(selected),
                available: problemVariants
            }
        };
    } catch (e) {
        throw error(404, 'Problem not found');
    }
};
