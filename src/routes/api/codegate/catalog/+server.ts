import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gateLanguages, leetcodeDifficultyLevels, type GateLanguage, type LeetcodeDifficulty } from '$lib/codegate/types';
import { requireActiveChallenge } from '$lib/server/codegate/sessions';
import { availableProblemCatalog } from '$lib/server/codegate/runtime-challenge';

function readBound(value: string | null): number | null {
    const parsed = Number(value);
    return value !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        requireActiveChallenge(url.searchParams.get('sessionId') ?? '', url.searchParams.get('challengeId') ?? '');
        const requestedLanguage = url.searchParams.get('language');
        const language: GateLanguage = gateLanguages.includes(requestedLanguage as GateLanguage)
            ? requestedLanguage as GateLanguage
            : 'python';
        const requestedDifficulties = (url.searchParams.get('leetcodeDifficulties') ?? '')
            .split(',')
            .filter((value): value is LeetcodeDifficulty => leetcodeDifficultyLevels.includes(value as LeetcodeDifficulty));
        const leetcodeDifficulties = requestedDifficulties.length ? requestedDifficulties : [...leetcodeDifficultyLevels];
        let min = readBound(url.searchParams.get('problemNumberMin'));
        let max = readBound(url.searchParams.get('problemNumberMax'));
        if (min !== null && max !== null && min > max) [min, max] = [max, min];
        return json(await availableProblemCatalog(language, leetcodeDifficulties, { min, max }));
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
    }
};
