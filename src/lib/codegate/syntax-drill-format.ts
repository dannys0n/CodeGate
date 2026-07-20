export function parseSyntaxDrillInfo(source: string, maximum = 8): string[] {
    const items: string[] = [];
    let current: string[] = [];

    const flush = () => {
        const item = current.join('\n').trim();
        if (item) items.push(item);
        current = [];
    };

    for (const line of source.split(/\r?\n/)) {
        const bullet = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.*)$/);
        if (bullet) {
            flush();
            current.push(bullet[1].trim());
        } else if (line.trim() || current.length) {
            current.push(line);
        }
    }
    flush();
    return items.slice(0, maximum);
}

export function truncateSyntaxDrillAtInfoLimit(source: string, maximum = 8): { text: string; reached: boolean } {
    const heading = source.match(/^#{1,3}\s+Info\s*(?:\r?\n|$)/im);
    if (heading?.index === undefined) return { text: source, reached: false };
    const bodyStart = heading.index + heading[0].length;
    const bulletPattern = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm;
    const bulletStarts: number[] = [];
    let match: RegExpExecArray | null;
    const body = source.slice(bodyStart);
    while ((match = bulletPattern.exec(body)) !== null) bulletStarts.push(bodyStart + match.index);
    if (bulletStarts.length < maximum) return { text: source, reached: false };

    const lineEnd = source.indexOf('\n', bulletStarts[maximum - 1]);
    if (lineEnd < 0) return { text: source, reached: false };
    return { text: source.slice(0, lineEnd + 1), reached: true };
}

export function truncateSyntaxDrillAfterFeatureInfo(source: string): { text: string; reached: boolean } {
    const heading = source.match(/^#{1,3}\s+Info\s*(?:\r?\n|$)/im);
    if (heading?.index === undefined) return { text: source, reached: false };
    const bodyStart = heading.index + heading[0].length;
    const bulletPattern = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(.*)$/gm;
    const body = source.slice(bodyStart);
    let match: RegExpExecArray | null;
    while ((match = bulletPattern.exec(body)) !== null) {
        if (/^Required setup\s*:/i.test(match[1].replace(/[*_`]/g, '').trim())) continue;
        const bulletStart = bodyStart + match.index;
        const lineEnd = source.indexOf('\n', bulletStart);
        if (lineEnd < 0) return { text: source, reached: false };
        return { text: source.slice(0, lineEnd + 1), reached: true };
    }
    return { text: source, reached: false };
}
