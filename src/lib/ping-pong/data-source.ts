import { env } from '$env/dynamic/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SESSION_STORAGE_PREFIX } from './constants';
import { createSessionCode, normalizeSessionCode } from './session-code';
import { loadSessionState, saveSessionState as saveStoredSessionState } from './storage';
import type { Match, Player, Session, SessionState } from './types';

type Unsubscribe = () => void;

export type PingPongDataSource = {
	name: 'local' | 'supabase';
	createSession: () => Promise<Session>;
	loadSession: (code: string) => Promise<SessionState>;
	saveSessionState: (state: SessionState) => Promise<void>;
	resetSession: (session: Session) => Promise<void>;
	subscribeToSession: (session: Session, onChange: () => void) => Unsubscribe;
};

type SessionRow = {
	id: string;
	code: string;
	name: string;
	created_at: string;
};

type PlayerRow = {
	id: string;
	session_id: string;
	name: string;
	elo: number;
	wins: number;
	losses: number;
};

type MatchRow = {
	id: string;
	session_id: string;
	player_a_id: string;
	player_b_id: string;
	winner_id: string;
	date: string;
	score_a: number;
	score_b: number;
	elo_before_a: number;
	elo_before_b: number;
	elo_after_a: number;
	elo_after_b: number;
};

function createSession(code = createSessionCode()): Session {
	const normalizedCode = normalizeSessionCode(code);

	return {
		id: crypto.randomUUID(),
		code: normalizedCode,
		name: `Sesja ${normalizedCode}`,
		createdAt: new Date().toISOString()
	};
}

function getStorageKey(code: string) {
	return `${SESSION_STORAGE_PREFIX}:${normalizeSessionCode(code)}`;
}

function toSession(row: SessionRow): Session {
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		createdAt: row.created_at
	};
}

function toPlayer(row: PlayerRow): Player {
	return {
		id: row.id,
		name: row.name,
		elo: row.elo,
		wins: row.wins,
		losses: row.losses
	};
}

function toMatch(row: MatchRow): Match {
	return {
		id: row.id,
		playerAId: row.player_a_id,
		playerBId: row.player_b_id,
		winnerId: row.winner_id,
		date: row.date,
		scoreA: row.score_a,
		scoreB: row.score_b,
		eloBeforeA: row.elo_before_a,
		eloBeforeB: row.elo_before_b,
		eloAfterA: row.elo_after_a,
		eloAfterB: row.elo_after_b
	};
}

function toPlayerRow(session: Session, player: Player): PlayerRow {
	return {
		id: player.id,
		session_id: session.id,
		name: player.name,
		elo: player.elo,
		wins: player.wins,
		losses: player.losses
	};
}

function toMatchRow(session: Session, match: Match): MatchRow {
	return {
		id: match.id,
		session_id: session.id,
		player_a_id: match.playerAId,
		player_b_id: match.playerBId,
		winner_id: match.winnerId,
		date: match.date,
		score_a: match.scoreA,
		score_b: match.scoreB,
		elo_before_a: match.eloBeforeA,
		elo_before_b: match.eloBeforeB,
		elo_after_a: match.eloAfterA,
		elo_after_b: match.eloAfterB
	};
}

function createLocalDataSource(): PingPongDataSource {
	return {
		name: 'local',
		async createSession() {
			const session = createSession();
			saveStoredSessionState(localStorage, getStorageKey(session.code), {
				session,
				players: [],
				matches: []
			});

			return session;
		},
		async loadSession(code) {
			const session = createSession(code);
			const state = loadSessionState(localStorage, getStorageKey(session.code), session);

			if (state.session.code !== session.code) {
				return {
					...state,
					session
				};
			}

			return state;
		},
		async saveSessionState(state) {
			saveStoredSessionState(localStorage, getStorageKey(state.session.code), state);
		},
		async resetSession(session) {
			saveStoredSessionState(localStorage, getStorageKey(session.code), {
				session,
				players: [],
				matches: []
			});
		},
		subscribeToSession() {
			return () => undefined;
		}
	};
}

function createSupabaseDataSource(supabase: SupabaseClient): PingPongDataSource {
	async function ensureSession(code: string) {
		const normalizedCode = normalizeSessionCode(code);
		const { data: existingSession, error: selectError } = await supabase
			.from('sessions')
			.select('*')
			.eq('code', normalizedCode)
			.maybeSingle<SessionRow>();

		if (selectError) throw selectError;
		if (existingSession) return toSession(existingSession);

		const session = createSession(normalizedCode);
		const { data: createdSession, error: insertError } = await supabase
			.from('sessions')
			.insert({
				id: session.id,
				code: session.code,
				name: session.name,
				created_at: session.createdAt
			})
			.select('*')
			.single<SessionRow>();

		if (insertError) throw insertError;
		return toSession(createdSession);
	}

	return {
		name: 'supabase',
		async createSession() {
			return ensureSession(createSessionCode());
		},
		async loadSession(code) {
			const session = await ensureSession(code);
			const [{ data: playerRows, error: playersError }, { data: matchRows, error: matchesError }] =
				await Promise.all([
					supabase.from('players').select('*').eq('session_id', session.id).order('name'),
					supabase.from('matches').select('*').eq('session_id', session.id).order('date', {
						ascending: false
					})
				]);

			if (playersError) throw playersError;
			if (matchesError) throw matchesError;

			return {
				session,
				players: (playerRows as PlayerRow[]).map(toPlayer),
				matches: (matchRows as MatchRow[]).map(toMatch)
			};
		},
		async saveSessionState(state) {
			await supabase.from('matches').delete().eq('session_id', state.session.id);
			await supabase.from('players').delete().eq('session_id', state.session.id);

			if (state.players.length > 0) {
				const { error } = await supabase
					.from('players')
					.insert(state.players.map((player) => toPlayerRow(state.session, player)));

				if (error) throw error;
			}

			if (state.matches.length > 0) {
				const { error } = await supabase
					.from('matches')
					.insert(state.matches.map((match) => toMatchRow(state.session, match)));

				if (error) throw error;
			}
		},
		async resetSession(session) {
			await supabase.from('matches').delete().eq('session_id', session.id);
			await supabase.from('players').delete().eq('session_id', session.id);
		},
		subscribeToSession(session, onChange) {
			const channel = supabase
				.channel(`ping-pong-session:${session.id}`)
				.on(
					'postgres_changes',
					{ event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` },
					onChange
				)
				.on(
					'postgres_changes',
					{ event: '*', schema: 'public', table: 'matches', filter: `session_id=eq.${session.id}` },
					onChange
				)
				.subscribe();

			return () => {
				void supabase.removeChannel(channel);
			};
		}
	};
}

export function createPingPongDataSource(): PingPongDataSource {
	if (env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY) {
		return createSupabaseDataSource(
			createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
				auth: {
					persistSession: false
				}
			})
		);
	}

	return createLocalDataSource();
}
