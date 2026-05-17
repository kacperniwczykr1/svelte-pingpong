import { normalizeSessionCode } from '$lib/ping-pong';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	return {
		sessionCode: normalizeSessionCode(params.code)
	};
};
