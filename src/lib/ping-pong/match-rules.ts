import { POINTS_TO_WIN } from './constants';

type MatchPlayerIds = {
	playerAId: string;
	playerBId: string;
};

type ServerState = MatchPlayerIds & {
	firstServerId: string;
	manualServerOffset: number;
	scoreA: number;
	scoreB: number;
};

export function getWinnerId(scoreA: number, scoreB: number, playerIds: MatchPlayerIds) {
	const maxScore = Math.max(scoreA, scoreB);
	const difference = Math.abs(scoreA - scoreB);

	if (maxScore >= POINTS_TO_WIN && difference >= 2) {
		return scoreA > scoreB ? playerIds.playerAId : playerIds.playerBId;
	}

	return '';
}

export function getCurrentServerId({
	firstServerId,
	manualServerOffset,
	playerAId,
	playerBId,
	scoreA,
	scoreB
}: ServerState) {
	if (!firstServerId || !playerAId || !playerBId) return '';

	const totalPoints = scoreA + scoreB;
	const isDeuceOrAfter = scoreA >= 10 && scoreB >= 10;
	const switchEvery = isDeuceOrAfter ? 1 : 2;
	const serveTurn = Math.floor(totalPoints / switchEvery) + manualServerOffset;
	const firstServerIsA = firstServerId === playerAId;
	const isFirstServerTurn = serveTurn % 2 === 0;

	if (firstServerIsA) {
		return isFirstServerTurn ? playerAId : playerBId;
	}

	return isFirstServerTurn ? playerBId : playerAId;
}
