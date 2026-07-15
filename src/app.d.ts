// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		codegateDesktop?: {
			settingsSnapshot: Record<string, unknown>;
			saveSettings(settings: object): Promise<Record<string, unknown>>;
			release(outcome: 'accepted' | 'given-up' | 'infrastructure-failure' | 'abandoned'): Promise<{ released: boolean }>;
			startupStatus(): Promise<boolean>;
			startupEventsStatus(): Promise<{ logon: boolean; unlock: boolean; resume: boolean }>;
			setStartupEvents(events: { logon: boolean; unlock: boolean; resume: boolean }): Promise<{ logon: boolean; unlock: boolean; resume: boolean }>;
		};
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
