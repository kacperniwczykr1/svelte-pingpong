import type { Match, Player, Session, SessionState, StoredPingPongState } from './types';

const emptyState: StoredPingPongState = {
	players: [],
	matches: []
};

export function loadPingPongState(storage: Storage, storageKey: string): StoredPingPongState {
	const saved = storage.getItem(storageKey);

	if (!saved) return emptyState;

	try {
		const parsed = JSON.parse(saved) as Partial<StoredPingPongState>;

		return {
			players: Array.isArray(parsed.players) ? (parsed.players as Player[]) : [],
			matches: Array.isArray(parsed.matches) ? (parsed.matches as Match[]) : []
		};
	} catch (error) {
		console.error('Blad odczytu danych z localStorage:', error);
		return emptyState;
	}
}

export function savePingPongState(
	storage: Storage,
	storageKey: string,
	state: StoredPingPongState
) {
	storage.setItem(storageKey, JSON.stringify(state));
}

export function loadSessionState(
	storage: Storage,
	storageKey: string,
	fallbackSession: Session
): SessionState {
	const saved = storage.getItem(storageKey);

	if (!saved) {
		return {
			...emptyState,
			session: fallbackSession
		};
	}

	try {
		const parsed = JSON.parse(saved) as Partial<SessionState>;

		return {
			session: parsed.session ?? fallbackSession,
			players: Array.isArray(parsed.players) ? (parsed.players as Player[]) : [],
			matches: Array.isArray(parsed.matches) ? (parsed.matches as Match[]) : []
		};
	} catch (error) {
		console.error('Blad odczytu danych sesji z localStorage:', error);

		return {
			...emptyState,
			session: fallbackSession
		};
	}
}

export function saveSessionState(storage: Storage, storageKey: string, state: SessionState) {
	storage.setItem(storageKey, JSON.stringify(state));
}
