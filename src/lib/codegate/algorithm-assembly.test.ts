import { describe, expect, it } from 'vitest';
import {
    emptyAssemblyState,
    isAssemblyCorrect,
    revealNextAssemblyBlock,
    type AlgorithmAssemblyLesson
} from './algorithm-assembly';

describe('algorithm assembly', () => {
    const order = ['initialize', 'scan', 'resolve', 'finish'];
    const lesson = { correctOrder: order } as AlgorithmAssemblyLesson;

    it('accepts only the complete canonical ordering', () => {
        expect(isAssemblyCorrect(order, order)).toBe(true);
        expect(isAssemblyCorrect(['initialize', 'resolve', 'scan', 'finish'], order)).toBe(false);
        expect(isAssemblyCorrect(['initialize', 'scan', null, 'finish'], order)).toBe(false);
    });

    it('reveals and locks the earliest incorrect position', () => {
        const state = {
            slots: ['initialize', 'resolve', 'scan', null],
            lockedPositions: new Set<number>()
        };
        const revealed = revealNextAssemblyBlock(state, order);

        expect(revealed.revealedPosition).toBe(1);
        expect(revealed.slots).toEqual(['initialize', 'scan', null, null]);
        expect([...revealed.lockedPositions]).toEqual([1]);
        expect(state.slots).toEqual(['initialize', 'resolve', 'scan', null]);
    });

    it('builds a complete answer through progressive reveals', () => {
        let state = emptyAssemblyState(lesson);
        for (let index = 0; index < order.length; index += 1) {
            state = revealNextAssemblyBlock(state, order);
        }
        expect(state.slots).toEqual(order);
        expect(isAssemblyCorrect(state.slots, order)).toBe(true);
    });
});
