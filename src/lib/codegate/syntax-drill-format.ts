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
