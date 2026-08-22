export type AssemblySourceBlock = { id: string; code: string; displayCode: string };
export type AssemblySourcePartition = { fixedPrefix: string; fixedSuffix: string; blocks: AssemblySourceBlock[] };
type Span = { start: number; end: number };

function dedent(source: string): string {
    const lines = source.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
    const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);
    const amount = indents.length ? Math.min(...indents) : 0;
    return lines.map((line) => line.slice(Math.min(amount, line.length))).join('\n');
}

function mergeSpans(spans: Span[], maximumBlocks: number): Span[] {
    const targetCount = Math.min(maximumBlocks, spans.length);
    if (targetCount < 1) throw new Error('The solution contains no movable statements');
    if (spans.length === targetCount) return spans;
    const total = spans.reduce((sum, span) => sum + span.end - span.start, 0);
    const merged: Span[] = [];
    let cursor = 0;
    for (let group = 0; group < targetCount; group += 1) {
        const remainingGroups = targetCount - group;
        if (remainingGroups === 1) {
            merged.push({ start: spans[cursor].start, end: spans[spans.length - 1].end });
            break;
        }
        const limit = spans.length - remainingGroups + 1;
        let end = cursor + 1;
        let size = spans[cursor].end - spans[cursor].start;
        const ideal = total / targetCount;
        while (end < limit) {
            const nextSize = spans[end].end - spans[end].start;
            if (size >= ideal || Math.abs(size - ideal) <= Math.abs(size + nextSize - ideal)) break;
            size += nextSize;
            end += 1;
        }
        merged.push({ start: spans[cursor].start, end: spans[end - 1].end });
        cursor = end;
    }
    return merged;
}

function partition(source: string, body: Span, statements: Span[], maximumBlocks: number): AssemblySourcePartition {
    const spans = mergeSpans(statements, maximumBlocks);
    const blocks = spans.map((span, index) => {
        const code = source.slice(span.start, span.end);
        return { id: `block-${index + 1}`, code, displayCode: dedent(code) };
    });
    const reconstructed = source.slice(0, body.start) + blocks.map((block) => block.code).join('') + source.slice(body.end);
    if (reconstructed !== source) throw new Error('The solution could not be partitioned without changing its source');
    return { fixedPrefix: source.slice(0, body.start), fixedSuffix: source.slice(body.end), blocks };
}

type CppScan = {
    pairs: Map<number, number>;
    closingBraces: Set<number>;
    groupingOpenings: Set<number>;
    groupingClosings: Set<number>;
    semicolons: Set<number>;
};
function scanCpp(source: string): CppScan {
    const pairs = new Map<number, number>();
    const closingBraces = new Set<number>();
    const groupingOpenings = new Set<number>();
    const groupingClosings = new Set<number>();
    const semicolons = new Set<number>();
    const stack: number[] = [];
    let state: 'code' | 'line-comment' | 'block-comment' | 'single' | 'double' | 'raw' = 'code';
    let escaped = false;
    let rawEnd = '';
    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1] ?? '';
        if (state === 'line-comment') { if (char === '\n') state = 'code'; continue; }
        if (state === 'block-comment') { if (char === '*' && next === '/') { state = 'code'; index += 1; } continue; }
        if (state === 'raw') { if (rawEnd && source.startsWith(rawEnd, index)) { index += rawEnd.length - 1; state = 'code'; } continue; }
        if (state === 'single' || state === 'double') {
            if (escaped) { escaped = false; continue; }
            if (char === '\\') { escaped = true; continue; }
            if ((state === 'single' && char === "'") || (state === 'double' && char === '"')) state = 'code';
            continue;
        }
        if (char === '/' && next === '/') { state = 'line-comment'; index += 1; continue; }
        if (char === '/' && next === '*') { state = 'block-comment'; index += 1; continue; }
        if (char === 'R' && next === '"') {
            const opening = source.indexOf('(', index + 2);
            if (opening >= 0 && opening - index <= 18) {
                const delimiter = source.slice(index + 2, opening);
                if (!/[\s\\()]/.test(delimiter)) { rawEnd = `)${delimiter}"`; state = 'raw'; index = opening; continue; }
            }
        }
        if (char === "'") state = 'single';
        else if (char === '"') state = 'double';
        else if (char === '{') stack.push(index);
        else if (char === '}') { const opening = stack.pop(); if (opening !== undefined) { pairs.set(opening, index); closingBraces.add(index); } }
        else if (char === '(' || char === '[') groupingOpenings.add(index);
        else if (char === ')' || char === ']') groupingClosings.add(index);
        else if (char === ';') semicolons.add(index);
    }
    return { pairs, closingBraces, groupingOpenings, groupingClosings, semicolons };
}

function cppStatements(source: string, opening: number, closing: number, scan: CppScan): Span[] {
    const boundaries: number[] = [];
    let depth = 0;
    let groupingDepth = 0;
    for (let index = opening + 1; index < closing; index += 1) {
        if (scan.groupingOpenings.has(index)) { groupingDepth += 1; continue; }
        if (scan.groupingClosings.has(index)) { groupingDepth = Math.max(0, groupingDepth - 1); continue; }
        if (scan.pairs.has(index)) { depth += 1; continue; }
        if (scan.closingBraces.has(index) && depth > 0) {
            depth -= 1;
            if (depth === 0 && !/^\s*(?:;|else\b|catch\b|while\s*\()/.test(source.slice(index + 1, closing))) boundaries.push(index + 1);
            continue;
        }
        if (scan.semicolons.has(index) && depth === 0 && groupingDepth === 0) boundaries.push(index + 1);
    }
    const unique = [...new Set(boundaries)].filter((end) => end > opening + 1 && end < closing).sort((a, b) => a - b);
    const spans: Span[] = [];
    let start = opening + 1;
    for (const end of unique) {
        const statement = source.slice(start, end).trim();
        if (statement) {
            if (/^;+$/.test(statement) && spans.length) spans[spans.length - 1].end = end;
            else spans.push({ start, end });
            start = end;
        }
    }
    if (source.slice(start, closing).trim()) spans.push({ start, end: closing });
    else if (spans.length) spans[spans.length - 1].end = closing;
    return spans;
}

export function splitCppAssemblySource(source: string, maximumBlocks = 5): AssemblySourcePartition {
    if (!source.trim()) throw new Error('The indexed C++ solution is empty');
    const scan = scanCpp(source);
    const candidates = [...scan.pairs.entries()]
        .filter(([opening]) => /\)\s*(?:const\b|noexcept\b|override\b|final\b|->[^{}]+)*\s*$/.test(source.slice(Math.max(0, opening - 500), opening)))
        .map(([opening, closing]) => ({ opening, closing, statements: cppStatements(source, opening, closing, scan) }))
        .filter((candidate) => candidate.statements.length >= 1)
        .sort((a, b) => (b.closing - b.opening) - (a.closing - a.opening));
    const selected = candidates[0];
    if (!selected) throw new Error('The indexed C++ solution has no function body to assemble');
    return partition(source, { start: selected.opening + 1, end: selected.closing }, selected.statements, maximumBlocks);
}

type PythonLine = { start: number; end: number; indent: number; text: string };
function pythonLines(source: string): PythonLine[] {
    const lines: PythonLine[] = [];
    let start = 0;
    for (const match of source.matchAll(/[^\n]*(?:\n|$)/g)) {
        const text = match[0];
        if (!text) continue;
        const whitespace = text.match(/^[ \t]*/)?.[0] ?? '';
        const indent = [...whitespace].reduce((sum, char) => sum + (char === '\t' ? 4 : 1), 0);
        lines.push({ start, end: start + text.length, indent, text });
        start += text.length;
    }
    return lines;
}

function pythonStatementLines(lines: PythonLine[]): Set<number> {
    const starts = new Set<number>();
    let triple: "'''" | '\"\"\"' | null = null;
    let bracketDepth = 0;
    let continued = false;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex].text;
        const beganInContinuation = Boolean(triple) || bracketDepth > 0 || continued;
        let quote: "'" | '\"' | null = null;
        let escaped = false;
        let code = '';
        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];
            if (triple) {
                if (line.startsWith(triple, index)) { index += 2; triple = null; }
                continue;
            }
            if (quote) {
                if (escaped) { escaped = false; continue; }
                if (char === '\\') { escaped = true; continue; }
                if (char === quote) quote = null;
                continue;
            }
            if (line.startsWith("'''", index) || line.startsWith('\"\"\"', index)) {
                triple = line.startsWith("'''", index) ? "'''" : '\"\"\"';
                code += 'x';
                index += 2;
                continue;
            }
            if (char === "'" || char === '\"') { quote = char; code += 'x'; continue; }
            if (char === '#') break;
            if (char === '(' || char === '[' || char === '{') bracketDepth += 1;
            else if (char === ')' || char === ']' || char === '}') bracketDepth = Math.max(0, bracketDepth - 1);
            code += char;
        }
        if (!beganInContinuation && code.trim()) starts.add(lineIndex);
        continued = /\\\s*(?:#.*)?(?:\r?\n)?$/.test(line);
    }
    return starts;
}

function pythonFunctionCandidates(source: string): Array<{ body: Span; statements: Span[] }> {
    const lines = pythonLines(source);
    const statementLines = pythonStatementLines(lines);
    const result: Array<{ body: Span; statements: Span[] }> = [];
    for (let index = 0; index < lines.length; index += 1) {
        const declaration = lines[index];
        if (!/^\s*(?:async\s+)?def\s+\w+\s*\(/.test(declaration.text)) continue;
        let headerEndLine = index;
        while (headerEndLine < lines.length && !/:\s*(?:#.*)?(?:\r?\n)?$/.test(lines[headerEndLine].text)) headerEndLine += 1;
        if (headerEndLine >= lines.length) continue;
        let bodyStartLine = headerEndLine + 1;
        while (bodyStartLine < lines.length && !lines[bodyStartLine].text.trim()) bodyStartLine += 1;
        if (bodyStartLine >= lines.length || lines[bodyStartLine].indent <= declaration.indent) continue;
        const bodyIndent = lines[bodyStartLine].indent;
        let bodyEndLine = bodyStartLine;
        while (bodyEndLine < lines.length && (!lines[bodyEndLine].text.trim() || lines[bodyEndLine].indent > declaration.indent)) bodyEndLine += 1;
        const starts: number[] = [];
        for (let line = bodyStartLine; line < bodyEndLine; line += 1) {
            const current = lines[line];
            if (!statementLines.has(line) || current.indent !== bodyIndent) continue;
            if (/^\s*(?:elif\b|else\s*:|except\b|finally\s*:)/.test(current.text)) continue;
            starts.push(current.start);
        }
        const body = { start: lines[bodyStartLine].start, end: bodyEndLine < lines.length ? lines[bodyEndLine].start : source.length };
        const statements = starts.map((start, statementIndex) => ({ start, end: starts[statementIndex + 1] ?? body.end }));
        if (statements.length >= 1) result.push({ body, statements });
    }
    return result;
}

export function splitPythonAssemblySource(source: string, maximumBlocks = 5): AssemblySourcePartition {
    if (!source.trim()) throw new Error('The indexed Python solution is empty');
    const candidates = pythonFunctionCandidates(source).sort((a, b) => (b.body.end - b.body.start) - (a.body.end - a.body.start));
    const selected = candidates[0];
    if (!selected) throw new Error('The indexed Python solution has no function body to assemble');
    return partition(source, selected.body, selected.statements, maximumBlocks);
}

export function splitAssemblySource(source: string, language: 'cpp' | 'python', maximumBlocks = 5): AssemblySourcePartition {
    return language === 'python' ? splitPythonAssemblySource(source, maximumBlocks) : splitCppAssemblySource(source, maximumBlocks);
}

export function shuffledAssemblyOrder(blocks: readonly AssemblySourceBlock[], random: () => number = Math.random): string[] {
    const canonical = blocks.map((block) => block.id);
    const shuffled = [...canonical];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const target = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    if (shuffled.length > 1 && shuffled.every((id, index) => id === canonical[index])) shuffled.push(shuffled.shift()!);
    return shuffled;
}
