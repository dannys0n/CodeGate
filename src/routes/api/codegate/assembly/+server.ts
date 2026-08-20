import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AlgorithmAssemblyLesson } from '$lib/codegate/algorithm-assembly';
import { shuffledAssemblyOrder, splitAssemblySource } from '$lib/codegate/algorithm-assembly-source';
import { loadCandidateAssets, loadCandidateManifest } from '$lib/server/codegate/catalog';
import { requireActiveChallenge } from '$lib/server/codegate/sessions';

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).filter((item) => item.trim().length > 0) : [];
}

function examples(value: unknown): Array<{ input: string; output: string }> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        const text = String(entry?.example_text ?? entry?.text ?? '').trim();
        if (!text) return [];
        const input = /(?:^|\n)Input:\s*([\s\S]*?)(?=\nOutput:|$)/i.exec(text)?.[1]?.trim();
        const output = /(?:^|\n)Output:\s*([\s\S]*?)(?=\nExplanation:|$)/i.exec(text)?.[1]?.trim();
        return input && output ? [{ input, output }] : [{ input: text, output: '' }];
    });
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        const session = requireActiveChallenge(url.searchParams.get('sessionId') ?? '', url.searchParams.get('challengeId') ?? '');
        const language = url.searchParams.get('language') === 'python' ? 'python' : 'cpp';
        const problemId = session.challenge.variant.problemId;
        const manifest = await loadCandidateManifest();
        const indexed = Object.entries(manifest.problems).find(([, problem]) => problem.slug === problemId);
        if (!indexed) throw new Error('This problem is not indexed for Algorithm Assembly');
        const [frontendId, candidate] = indexed;
        if (!candidate.languages[language]) throw new Error(`This problem has no indexed ${language === 'cpp' ? 'C++' : 'Python'} solution`);

        const assets = await loadCandidateAssets(frontendId, language);
        const blocks = splitAssemblySource(assets.solution, language);
        const correctOrder = blocks.map((block) => block.id);
        const lesson: AlgorithmAssemblyLesson = {
            id: `${candidate.slug}-${language}`,
            language,
            problem: {
                number: Number(frontendId),
                title: String(assets.record.title ?? candidate.catalogTitle ?? candidate.slug),
                difficulty: candidate.leetcodeDifficulty,
                statement: String(assets.record.description ?? ''),
                examples: examples(assets.record.examples),
                constraints: strings(assets.record.constraints),
                hints: strings(assets.record.hints)
            },
            fixedPrefix: '',
            fixedSuffix: '',
            blocks,
            initialBlockOrder: shuffledAssemblyOrder(blocks),
            correctOrder
        };
        return json(lesson);
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
    }
};
