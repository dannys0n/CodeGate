import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPlayableManifest } from '$lib/server/codegate/catalog';

export const GET: RequestHandler = async () => {
    try {
        const manifest = await loadPlayableManifest();
        return json({
            ready: manifest.variants.length > 0,
            playableVariants: manifest.variants.length,
            instanceToken: process.env.CODEGATE_INSTANCE_TOKEN ?? null
        });
    } catch (error) {
        return json({ ready: false, playableVariants: 0, error: error instanceof Error ? error.message : String(error) }, { status: 503 });
    }
};
