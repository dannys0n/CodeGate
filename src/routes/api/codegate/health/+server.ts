import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadCandidateManifest } from '$lib/server/codegate/catalog';

export const GET: RequestHandler = async () => {
    try {
        const manifest = await loadCandidateManifest();
        const problemLanguages = Object.values(manifest.problems).reduce((total, problem) => total + Object.keys(problem.languages).length, 0);
        return json({
            ready: Object.keys(manifest.problems).length > 0,
            candidateVariants: problemLanguages,
            instanceToken: process.env.CODEGATE_INSTANCE_TOKEN ?? null
        });
    } catch (error) {
        return json({ ready: false, candidateVariants: 0, error: error instanceof Error ? error.message : String(error) }, { status: 503 });
    }
};
