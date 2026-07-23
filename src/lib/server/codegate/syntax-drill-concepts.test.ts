import { describe, expect, it } from 'vitest';
import { gateLanguages, type GateLanguage } from '../../codegate/types';
import { normalizeSyntaxDrillLearning, recordSyntaxConcept, type SyntaxDrillLearning } from '../../codegate/syntax-drill-learning';
import { selectSyntaxDrillConcept, syntaxDrillConcepts } from './syntax-drill-concepts';

function passedConcepts(language: GateLanguage, stage: number, count: number): SyntaxDrillLearning {
    const concepts = Object.fromEntries(syntaxDrillConcepts(language)
        .filter((concept) => concept.stage === stage)
        .slice(0, count)
        .map((concept) => [concept.id, { seen: 1, passed: 1 }]));
    return { [language]: { concepts, recent: [] } };
}

describe('syntax drill curriculum', () => {
    it('provides a broad, unique, staged curriculum for every supported language', () => {
        for (const language of gateLanguages) {
            const curriculum = syntaxDrillConcepts(language);
            expect(curriculum.length, language).toBeGreaterThanOrEqual(30);
            expect(new Set(curriculum.map((concept) => concept.id)).size, language).toBe(curriculum.length);
            expect(new Set(curriculum.map((concept) => concept.family)).size, language).toBeGreaterThanOrEqual(7);
            expect(new Set(curriculum.map((concept) => concept.stage)), language).toEqual(new Set([1, 2, 3, 4]));
            expect(curriculum.every((concept) => concept.title && concept.requirements.length > 0), language).toBe(true);
        }
    });

    it('keeps everyday C++ and Python data structures in the curriculum', () => {
        const ids = (language: GateLanguage) => new Set(syntaxDrillConcepts(language).map((concept) => concept.id));
        expect([...ids('cpp')]).toEqual(expect.arrayContaining([
            'std-vector', 'std-deque', 'std-stack', 'std-queue', 'ordered-map',
            'ordered-set', 'unordered-map', 'unordered-set', 'priority-queue', 'nested-vector'
        ]));
        expect([...ids('python')]).toEqual(expect.arrayContaining([
            'list-literal', 'dict-literal', 'set', 'nested-list', 'deque', 'heapq',
            'defaultdict', 'counter'
        ]));
    });

    it('starts with fundamentals and unlocks later stages through distinct passes', () => {
        expect(selectSyntaxDrillConcept('python', {}, () => 0).stage).toBe(1);
        const stageOnePassed = passedConcepts('python', 1, 6);
        expect(selectSyntaxDrillConcept('python', stageOnePassed, () => 0.999).stage).toBe(2);
    });

    it('does not immediately repeat a recent concept when alternatives exist', () => {
        const first = syntaxDrillConcepts('cpp').find((concept) => concept.stage === 1)!;
        const learning: SyntaxDrillLearning = { cpp: { concepts: { [first.id]: { seen: 1, passed: 0 } }, recent: [first.id] } };
        expect(selectSyntaxDrillConcept('cpp', learning, () => 0).id).not.toBe(first.id);
    });

    it('chooses unseen concepts before recycling previously shown drills', () => {
        const stageOne = syntaxDrillConcepts('cpp').filter((concept) => concept.stage === 1);
        const seen = stageOne.slice(0, -1);
        const learning: SyntaxDrillLearning = {
            cpp: {
                concepts: Object.fromEntries(seen.map((concept) => [concept.id, { seen: 1, passed: 0 }])),
                recent: seen.slice(-12).map((concept) => concept.id)
            }
        };
        expect(selectSyntaxDrillConcept('cpp', learning, () => 0).id).toBe(stageOne.at(-1)?.id);
    });

    it('avoids recently used concept families when another family is available', () => {
        const stageOne = syntaxDrillConcepts('python').filter((concept) => concept.stage === 1);
        const recent = stageOne.find((concept) => concept.family === 'fundamentals')!;
        const learning: SyntaxDrillLearning = { python: { concepts: {}, recent: [recent.id] } };
        expect(selectSyntaxDrillConcept('python', learning, () => 0).family).not.toBe('fundamentals');
    });

    it('sanitizes and bounds persisted learning state', () => {
        const normalized = normalizeSyntaxDrillLearning({
            python: {
                concepts: { assignment: { seen: 4, passed: 9 }, '../bad': { seen: 1, passed: 1 } },
                recent: ['assignment', 42, '../bad']
            },
            invalid: { concepts: {} }
        });
        expect(normalized.python?.concepts).toEqual({ assignment: { seen: 4, passed: 4 } });
        expect(normalized.python?.recent).toEqual(['assignment']);
        expect(normalized).not.toHaveProperty('invalid');
    });

    it('records exposure separately from mastery', () => {
        const seen = recordSyntaxConcept({}, 'go', 'short-declaration', 'seen');
        expect(seen.go?.concepts['short-declaration']).toEqual({ seen: 1, passed: 0 });
        const passed = recordSyntaxConcept(seen, 'go', 'short-declaration', 'passed');
        expect(passed.go?.concepts['short-declaration']).toEqual({ seen: 1, passed: 1 });
        expect(passed.go?.recent).toEqual(['short-declaration']);
    });
});
