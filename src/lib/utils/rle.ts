import type { Pattern } from '$lib/types';

export function parseRLE(rleString: string): Pattern {
	const lines = rleString.trim().split('\n');

	let patternData = '';
	let width = 0;
	let height = 0;
	let rule: string | undefined;

	let name: string | undefined;
	let author: string | undefined;
	const comments: string[] = [];

	for (const line of lines) {
		if (line.startsWith('#N')) {
			name = line.substring(2).trim();
		} else if (line.startsWith('#O')) {
			author = line.substring(2).trim();
		} else if (line.startsWith('#C')) {
			comments.push(line.substring(2).trim());
		} else if (line.startsWith('x')) {
			const xMatch = line.match(/x\s*=\s*(\d+)/);
			const yMatch = line.match(/y\s*=\s*(\d+)/);
			const ruleMatch = line.match(/rule\s*=\s*([^\s]+)/);

			if (xMatch) width = parseInt(xMatch[1], 10);
			if (yMatch) height = parseInt(yMatch[1], 10);
			if (ruleMatch) rule = ruleMatch[1];
		} else if (!line.startsWith('#')) {
			patternData += line;
		}
	}

	patternData = patternData.replace(/!/g, '').trim();

	const pattern = Array.from({ length: height }, () => Array(width).fill(false));

	let row = 0;
	let col = 0;
	let runCount = '';

	for (let i = 0; i < patternData.length; i++) {
		const char = patternData[i];

		if (char >= '0' && char <= '9') {
			runCount += char;
		} else if (char === 'b') {
			col += runCount === '' ? 1 : parseInt(runCount, 10);
			runCount = '';
		} else if (char === 'o') {
			const count = runCount === '' ? 1 : parseInt(runCount, 10);
			for (let j = 0; j < count; j++) {
				if (row < height && col < width) {
					pattern[row][col] = true;
				}
				col++;
			}
			runCount = '';
		} else if (char === '$') {
			row += runCount === '' ? 1 : parseInt(runCount, 10);
			col = 0;
			runCount = '';
		}
	}

	return {
		pattern,
		width,
		height,
		name,
		author,
		comments,
		rule
	};
}
