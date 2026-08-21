import type { LeetcodeDifficulty } from './types';
import { writable, type Readable } from 'svelte/store';

export type AlgorithmAssemblyBlock = {
    id: string;
    code: string;
    displayCode: string;
};

export type AlgorithmAssemblyLesson = {
    id: string;
    language: 'cpp' | 'python';
    problem: {
        number: number;
        title: string;
        difficulty: LeetcodeDifficulty;
        statement: string;
        examples: Array<{ input: string; output: string }>;
        constraints: string[];
        hints?: string[];
    };
    fixedPrefix: string;
    fixedSuffix: string;
    blocks: AlgorithmAssemblyBlock[];
    initialBlockOrder: string[];
    correctOrder: string[];
};

export type AlgorithmAssemblyState = {
    slots: Array<string | null>;
    lockedPositions: Set<number>;
};

export type AlgorithmAssemblySessionState = {
    assembly: AlgorithmAssemblyState;
    hintsUsed: number;
    completed: boolean;
    status: string;
    statusKind: 'neutral' | 'error' | 'success';
};

export type AlgorithmAssemblySession = Readable<AlgorithmAssemblySessionState> & {
    placeBlock: (blockId: string) => void;
    removeBlock: (position: number) => void;
    checkOrder: () => void;
    revealNextBlock: () => void;
    reset: () => void;
};

export function emptyAssemblyState(lesson: AlgorithmAssemblyLesson): AlgorithmAssemblyState {
    return {
        slots: Array.from({ length: lesson.correctOrder.length }, () => null),
        lockedPositions: new Set<number>()
    };
}

export function isAssemblyCorrect(slots: Array<string | null>, correctOrder: string[]): boolean {
    return slots.length === correctOrder.length && slots.every((blockId, index) => blockId === correctOrder[index]);
}

export function revealNextAssemblyBlock(state: AlgorithmAssemblyState, correctOrder: string[]): AlgorithmAssemblyState & { revealedPosition: number | null } {
    const revealedPosition = correctOrder.findIndex((blockId, index) => state.slots[index] !== blockId);
    if (revealedPosition < 0) return { ...state, revealedPosition: null };

    const correctBlockId = correctOrder[revealedPosition];
    const slots = [...state.slots];
    const existingPosition = slots.indexOf(correctBlockId);
    if (existingPosition >= 0) slots[existingPosition] = null;
    slots[revealedPosition] = correctBlockId;

    const lockedPositions = new Set(state.lockedPositions);
    lockedPositions.add(revealedPosition);
    return { slots, lockedPositions, revealedPosition };
}

export function createAlgorithmAssemblySession(lesson: AlgorithmAssemblyLesson): AlgorithmAssemblySession {
    const initial = (): AlgorithmAssemblySessionState => ({
        assembly: emptyAssemblyState(lesson),
        hintsUsed: 0,
        completed: false,
        status: 'Tap a block to place it in the first empty slot.',
        statusKind: 'neutral'
    });
    const store = writable(initial());

    function checkOrder() {
        store.update((session) => {
            if (session.assembly.slots.some((slot) => slot === null)) {
                return { ...session, status: 'Place all blocks before checking the order.', statusKind: 'error' };
            }
            if (!isAssemblyCorrect(session.assembly.slots, lesson.correctOrder)) {
                return { ...session, status: 'The ordering is not correct yet.', statusKind: 'error' };
            }
            return {
                ...session,
                completed: true,
                status: session.hintsUsed === 0
                    ? 'Correct — completed independently.'
                    : `Correct — completed with ${session.hintsUsed} ${session.hintsUsed === 1 ? 'hint' : 'hints'}.`,
                statusKind: 'success'
            };
        });
    }

    return {
        subscribe: store.subscribe,
        placeBlock(blockId) {
            store.update((session) => {
                if (session.completed || session.assembly.slots.includes(blockId)) return session;
                const position = session.assembly.slots.findIndex((slot) => slot === null);
                if (position < 0) return { ...session, status: 'Remove an unlocked block before placing another.', statusKind: 'error' };
                const slots = [...session.assembly.slots];
                slots[position] = blockId;
                return {
                    ...session,
                    assembly: { ...session.assembly, slots },
                    status: 'Keep arranging the blocks, then check the order.',
                    statusKind: 'neutral'
                };
            });
        },
        removeBlock(position) {
            store.update((session) => {
                if (session.completed || session.assembly.lockedPositions.has(position) || !session.assembly.slots[position]) return session;
                const slots = [...session.assembly.slots];
                slots[position] = null;
                return {
                    ...session,
                    assembly: { ...session.assembly, slots },
                    status: 'The block returned to the available list.',
                    statusKind: 'neutral'
                };
            });
        },
        checkOrder,
        revealNextBlock() {
            let shouldCheck = false;
            store.update((session) => {
                if (session.completed) return session;
                const revealed = revealNextAssemblyBlock(session.assembly, lesson.correctOrder);
                if (revealed.revealedPosition === null) {
                    shouldCheck = true;
                    return session;
                }
                const assembly = { slots: revealed.slots, lockedPositions: revealed.lockedPositions };
                shouldCheck = isAssemblyCorrect(assembly.slots, lesson.correctOrder);
                return {
                    ...session,
                    assembly,
                    hintsUsed: session.hintsUsed + 1,
                    status: `Revealed and locked block ${revealed.revealedPosition + 1}.`,
                    statusKind: 'neutral'
                };
            });
            if (shouldCheck) checkOrder();
        },
        reset() { store.set(initial()); }
    };
}
