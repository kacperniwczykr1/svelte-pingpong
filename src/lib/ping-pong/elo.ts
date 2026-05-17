import { K_FACTOR } from './constants';
import type { MatchSide } from './types';

export function expectedScore(playerRating: number, opponentRating: number) {
	return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

export function calculateNewRatings(
	playerARating: number,
	playerBRating: number,
	winner: MatchSide
) {
	const expectedA = expectedScore(playerARating, playerBRating);
	const expectedB = expectedScore(playerBRating, playerARating);

	const scoreA = winner === 'A' ? 1 : 0;
	const scoreB = winner === 'B' ? 1 : 0;

	return {
		newA: Math.round(playerARating + K_FACTOR * (scoreA - expectedA)),
		newB: Math.round(playerBRating + K_FACTOR * (scoreB - expectedB))
	};
}
