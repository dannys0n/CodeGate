export type AiStreamEvent = { type: 'status' | 'text' | 'done' | 'error'; text?: string };

export async function consumeAiStream(response: Response, onEvent: (event: AiStreamEvent) => void) {
    if (!response.ok || !response.body) throw new Error((await response.text().catch(() => '')).trim() || `Request failed with ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const block of events) {
            const line = block.split('\n').find((entry) => entry.startsWith('data:'));
            if (!line) continue;
            const event = JSON.parse(line.slice(5).trim()) as AiStreamEvent;
            onEvent(event);
            if (event.type === 'error') throw new Error(event.text || 'Local AI request failed');
        }
        if (done) break;
    }
}
