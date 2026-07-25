import { describe, expect, it } from 'vitest';
import {
    completeLanguageDocument,
    ContentLengthDecoder,
    hoverLanguageDocument,
    stopLanguageServers,
    syncLanguageDocument
} from './language-server';
import type { GateLanguage } from '$lib/codegate/types';

function frame(value: unknown) {
    const body = JSON.stringify(value);
    return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

describe('language-server protocol framing', () => {
    it('decodes fragmented messages', () => {
        const decoder = new ContentLengthDecoder();
        const message = frame({ jsonrpc: '2.0', id: 1, result: ['value'] });
        expect(decoder.push(message.slice(0, 18))).toEqual([]);
        expect(decoder.push(message.slice(18))).toEqual([{ jsonrpc: '2.0', id: 1, result: ['value'] }]);
    });

    it('decodes multiple messages in one chunk', () => {
        const decoder = new ContentLengthDecoder();
        expect(decoder.push(frame({ id: 1 }) + frame({ id: 2 }))).toEqual([{ id: 1 }, { id: 2 }]);
    });
});

const integrationCases: Partial<Record<GateLanguage, { source: string; needle: string; expected: RegExp }>> = {
    cpp: {
        source: '#include <vector>\nusing namespace std;\nvoid test() { vector<int> values; values.p }',
        needle: 'values.p', expected: /^push_back/
    },
    python: {
        source: 'values = []\nvalues.ap', needle: 'values.ap', expected: /^append/
    },
    java: {
        source: 'class Solution { void test() { var values = new java.util.ArrayList<Integer>(); values.ad } }',
        needle: 'values.ad', expected: /^add/
    },
    csharp: {
        source: 'using System.Collections.Generic; class Solution { void Test() { var values = new List<int>(); values.Ad } }',
        needle: 'values.Ad', expected: /^Add/
    },
    rust: {
        source: 'fn test() { let mut values: Vec<i32> = Vec::new(); values.p }',
        needle: 'values.p', expected: /^push/
    },
    go: {
        source: 'package main\nimport "strings"\nfunc test() { strings.To }',
        needle: 'strings.To', expected: /^To/
    },
    typescript: {
        source: 'const values: number[] = [];\nvalues.pu', needle: 'values.pu', expected: /^push/
    }
};

const integrationLanguage = process.env.CODEGATE_INTELLISENSE_INTEGRATION as GateLanguage | undefined;
describe.runIf(Boolean(integrationLanguage))('language-server completion integration', () => {
    it(`returns semantic ${integrationLanguage} completions`, async () => {
        const test = integrationLanguage ? integrationCases[integrationLanguage] : undefined;
        if (!integrationLanguage || !test) throw new Error('Unknown integration language');
        const documentId = `integration-${integrationLanguage}`;
        const offset = test.source.indexOf(test.needle) + test.needle.length;
        const prefix = test.source.slice(0, offset);
        const line = prefix.split('\n').length - 1;
        const character = prefix.length - prefix.lastIndexOf('\n') - 1;
        await syncLanguageDocument(integrationLanguage, documentId, test.source);
        const items = await completeLanguageDocument(integrationLanguage, documentId, line, character);
        const labels = items.map((entry: any) => (typeof entry.label === 'string' ? entry.label : entry.label?.label)?.trim());
        expect(labels.some((label: string) => test.expected.test(label)), JSON.stringify(labels)).toBe(true);
        const hoverOffset = test.source.indexOf('values') + 1;
        const hoverPrefix = test.source.slice(0, hoverOffset);
        const hoverLine = hoverPrefix.split('\n').length - 1;
        const hoverCharacter = hoverPrefix.length - hoverPrefix.lastIndexOf('\n') - 1;
        const hover = await hoverLanguageDocument(integrationLanguage, documentId, hoverLine, hoverCharacter);
        expect(JSON.stringify(hover?.contents ?? '')).not.toBe('""');
        stopLanguageServers();
    }, 90_000);
});
