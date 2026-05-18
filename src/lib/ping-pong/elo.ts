import { K_FACTOR } from './constants';
import type { MatchSide } from './types';

const MAX_SCORE_IMPACT = 1.5;
const SCORE_IMPACT_WEIGHT = 0.5;

export function expectedScore(playerRating: number, opponentRating: number) {
	return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

export function getScoreImpact(scoreA: number, scoreB: number) {
	const winnerScore = Math.max(scoreA, scoreB);
	const loserScore = Math.min(scoreA, scoreB);

	if (winnerScore <= 0) return 1;

	const marginRatio = (winnerScore - loserScore) / winnerScore;
	const impact = 1 + SCORE_IMPACT_WEIGHT * marginRatio;

	return Math.min(MAX_SCORE_IMPACT, impact);
}

export function calculateNewRatings(
	playerARating: number,
	playerBRating: number,
	winner: MatchSide,
	score?: {
		scoreA: number;
		scoreB: number;
	}
) {
	const expectedA = expectedScore(playerARating, playerBRating);
	const expectedB = expectedScore(playerBRating, playerARating);
	const scoreImpact = score ? getScoreImpact(score.scoreA, score.scoreB) : 1;

	const scoreA = winner === 'A' ? 1 : 0;
	const scoreB = winner === 'B' ? 1 : 0;

	return {
		newA: Math.round(playerARating + K_FACTOR * scoreImpact * (scoreA - expectedA)),
		newB: Math.round(playerBRating + K_FACTOR * scoreImpact * (scoreB - expectedB)),
		scoreImpact
	};
}
