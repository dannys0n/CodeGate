import { afterEach, describe, expect, it } from 'vitest';
import ContainerPool from './ContainerPool';

const originalDesktopMode = process.env.CODEGATE_DESKTOP;

afterEach(() => {
    if (originalDesktopMode === undefined) delete process.env.CODEGATE_DESKTOP;
    else process.env.CODEGATE_DESKTOP = originalDesktopMode;
});

describe('ContainerPool.containerLabels', () => {
    it('preserves the shared CoJudge cleanup label outside desktop mode', () => {
        delete process.env.CODEGATE_DESKTOP;
        expect(ContainerPool.containerLabels()).toEqual({ 'cojudge.created': 'true' });
    });

    it('adds an ownership label for installed CodeGate containers', () => {
        process.env.CODEGATE_DESKTOP = '1';
        expect(ContainerPool.containerLabels()).toEqual({
            'cojudge.created': 'true',
            'codegate.created': 'true'
        });
    });
});
