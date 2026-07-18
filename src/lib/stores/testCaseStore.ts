import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Key for localStorage
const STORAGE_KEY = 'testcases';

const defaultValue: Record<string, any[]> = {};
const storedValue: Record<string, any[]> = browser
    ? (JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultValue)
    : defaultValue;
// Syntax drills are intentionally ephemeral. Remove entries created by older builds
// that persisted their generated problem IDs alongside algorithm test cases.
const initialValue = Object.fromEntries(
    Object.entries(storedValue).filter(([problemId]) => !problemId.startsWith('ai-syntax-'))
);

const testCaseStore = writable<Record<string, any[]>>(initialValue);

if (browser) {
    testCaseStore.subscribe((value) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    });
}

export default testCaseStore;
