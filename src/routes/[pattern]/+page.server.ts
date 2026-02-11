import { parseRLE } from '$lib/utils/rle';
import { error } from '@sveltejs/kit';

import fs from 'node:fs';
import path from 'node:path';

export async function load({ params }) {
	// Path to the file in the static folder
	const filePath = path.resolve('static', `patterns/${params.pattern}.rle`);

	try {
		// Read the file as a string (or omit 'utf-8' for a Buffer)
		const fileContent = fs.readFileSync(filePath, 'utf-8');

		return {
			pattern: parseRLE(fileContent)
		};
	} catch (err) {
		console.error('Could not find the RLE file:', err);
		error(404, 'not found');
	}
}

// export async function load({ fetch, params }) {
// 	const res = await fetch(`https://copy.sh/life/examples/${params.pattern}.rle`);
// 	const rle_pattern = await res.text();
// 	const pattern = parseRLE(rle_pattern);
// 	return { pattern };
// }
