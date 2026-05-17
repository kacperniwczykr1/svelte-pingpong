export type Player = {
	id: string;
	name: string;
	elo: number;
	wins: number;
	losses: number;
};

export type Match = {
	id: string;
	playerAId: string;
	playerBId: string;
	winnerId: string;
	date: string;
	scoreA: number;
	scoreB: number;
	eloBeforeA: number;
	eloBeforeB: number;
	eloAfterA: number;
	eloAfterB: number;
};

export type MatchSide = 'A' | 'B';

export type Session = {
	id: string;
	code: string;
	name: string;
	createdAt: string;
};

export type StoredPingPongState = {
	players: Player[];
	matches: Match[];
};

export type SessionState = StoredPingPongState & {
	session: Session;
};
