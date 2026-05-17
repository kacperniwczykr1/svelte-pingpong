const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_CODE_LENGTH = 6;

export function normalizeSessionCode(code: string) {
	return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function createSessionCode(length = DEFAULT_CODE_LENGTH) {
	const values = crypto.getRandomValues(new Uint8Array(length));

	return Array.from(values, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
}
