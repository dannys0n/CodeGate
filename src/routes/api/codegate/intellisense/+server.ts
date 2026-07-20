import type { RequestHandler } from './$types';
import {
    closeLanguageDocument,
    completeLanguageDocument,
    requireLanguage,
    syncLanguageDocument
} from '$lib/server/codegate/language-server';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as Record<string, unknown>;
        const action = String(body.action ?? '');
        const language = requireLanguage(body.language);
        const documentId = typeof body.documentId === 'string' ? body.documentId : '';
        if (!/^[a-zA-Z0-9-]{1,80}$/.test(documentId)) throw new Error('Invalid IntelliSense document ID');
        if (action === 'close') {
            closeLanguageDocument(language, documentId);
            return new Response(null, { status: 204 });
        }
        if (action === 'sync') {
            const source = typeof body.source === 'string' ? body.source : '';
            if (source.length > 200_000) throw new Error('Invalid source');
            return Response.json({ version: await syncLanguageDocument(language, documentId, source) });
        }
        if (action !== 'complete') throw new Error('Invalid IntelliSense action');
        const line = Number(body.line);
        const character = Number(body.character);
        if (!Number.isInteger(line) || line < 0 || line > 20_000) throw new Error('Invalid completion line');
        if (!Number.isInteger(character) || character < 0 || character > 20_000) throw new Error('Invalid completion column');
        return Response.json({ items: await completeLanguageDocument(language, documentId, line, character, request.signal) });
    } catch (error) {
        return new Response(error instanceof Error ? error.message : String(error), { status: 503 });
    }
};
