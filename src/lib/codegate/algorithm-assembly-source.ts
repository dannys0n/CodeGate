export type AssemblySourceBlock = { id: string; code: string };

function safeBoundaries(source: string): { lines: number[]; structural: number[] } {
    const lines: number[] = [];
    const structural: number[] = [];
    let state: 'code' | 'line-comment' | 'block-comment' | 'single-quote' | 'double-quote' | 'raw-string' = 'code';
    let escaped = false;
    let rawTerminator = '';

    for (let index = 0; index < source.length; index += 1) {
        const current = source[index];
        const next = source[index + 1] ?? '';

        if (state === 'line-comment') {
            if (current === '\n') {
                state = 'code';
                if (source[index - 1] !== '\\') lines.push(index + 1);
            }
            continue;
        }
        if (state === 'block-comment') {
            if (current === '*' && next === '/') {
                state = 'code';
                index += 1;
            }
            continue;
        }
        if (state === 'raw-string') {
            if (rawTerminator && source.startsWith(rawTerminator, index)) {
                index += rawTerminator.length - 1;
                state = 'code';
            }
            continue;
        }
        if (state === 'single-quote' || state === 'double-quote') {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (current === '\\') {
                escaped = true;
                continue;
            }
            if ((state === 'single-quote' && current === "'") || (state === 'double-quote' && current === '"')) state = 'code';
            continue;
        }

        if (current === '/' && next === '/') {
            state = 'line-comment';
            index += 1;
            continue;
        }
        if (current === '/' && next === '*') {
            state = 'block-comment';
            index += 1;
            continue;
        }
        if (current === 'R' && next === '"') {
            const opening = source.indexOf('(', index + 2);
            if (opening >= 0 && opening - (index + 2) <= 16) {
                const delimiter = source.slice(index + 2, opening);
                if (!/[\s\\()]/.test(delimiter)) {
                    rawTerminator = `)${delimiter}"`;
                    state = 'raw-string';
                    index = opening;
                    continue;
                }
            }
        }
        if (current === ';' || current === '{' || current === '}') structural.push(index + 1);
        if (current === "'") state = 'single-quote';
        else if (current === '"') state = 'double-quote';
        else if (current === '\n' && source[index - 1] !== '\\') lines.push(index + 1);
    }

    const valid = (offset: number) => offset > 0 && offset < source.length;
    return { lines: lines.filter(valid), structural: structural.filter(valid) };
}

function chooseCuts(sourceLength: number, candidates: number[], blockCount: number): number[] | null {
    const minimumSize = Math.min(48, Math.max(1, Math.floor(sourceLength / (blockCount * 3))));
    const cuts: number[] = [];
    let previous = 0;
    for (let part = 1; part < blockCount; part += 1) {
        const remainingParts = blockCount - part;
        const target = Math.round(sourceLength * part / blockCount);
        const eligible = candidates.filter((offset) =>
            offset >= previous + minimumSize
            && sourceLength - offset >= remainingParts * minimumSize
            && !cuts.includes(offset)
        );
        if (!eligible.length) return null;
        const selected = eligible.reduce((best, offset) =>
            Math.abs(offset - target) < Math.abs(best - target) ? offset : best
        );
        cuts.push(selected);
        previous = selected;
    }
    return cuts;
}

export function splitCppAssemblySource(source: string, maximumBlocks = 5): AssemblySourceBlock[] {
    if (!source.trim()) throw new Error('The indexed C++ solution is empty');
    const boundaries = safeBoundaries(source);
    const allCandidates = [...new Set([...boundaries.lines, ...boundaries.structural])].sort((left, right) => left - right);
    const upperBound = Math.max(2, Math.min(maximumBlocks, allCandidates.length + 1));
    for (let blockCount = upperBound; blockCount >= 2; blockCount -= 1) {
        const cuts = chooseCuts(source.length, boundaries.lines, blockCount)
            ?? chooseCuts(source.length, allCandidates, blockCount);
        if (!cuts) continue;
        const offsets = [0, ...cuts, source.length];
        const blocks = offsets.slice(0, -1).map((start, index) => ({
            id: `block-${index + 1}`,
            code: source.slice(start, offsets[index + 1])
        }));
        if (blocks.every((block) => block.code.length > 0) && blocks.map((block) => block.code).join('') === source) return blocks;
    }
    throw new Error('The indexed C++ solution has no safe block boundaries');
}

export function shuffledAssemblyOrder(blocks: readonly AssemblySourceBlock[], random: () => number = Math.random): string[] {
    const canonical = blocks.map((block) => block.id);
    const shuffled = [...canonical];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const target = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    if (shuffled.every((id, index) => id === canonical[index])) shuffled.push(shuffled.shift()!);
    return shuffled;
}
