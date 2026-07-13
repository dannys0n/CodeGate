// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		codegateDesktop?: {
			release(outcome: 'accepted' | 'given-up' | 'infrastructure-failure' | 'abandoned'): Promise<{ released: boolean }>;
			startupStatus(): Promise<boolean>;
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
