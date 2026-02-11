export type RGBA = { r: number; g: number; b: number; a: number };

export function hexToRgba(hex: string): RGBA {
	hex = hex.replace('#', '');
	// Handle short hex (#fff)
	if (hex.length === 3)
		hex = hex
			.split('')
			.map((c) => c + c)
			.join('');
	// Handle standard hex (#ffffff) - default alpha to 1
	if (hex.length === 6) hex = hex + 'FF';

	const bigint = parseInt(hex, 16);
	return {
		r: (bigint >> 24) & 255,
		g: (bigint >> 16) & 255,
		b: (bigint >> 8) & 255,
		a: (bigint & 255) / 255
	};
}

export function rgbaToString(c: RGBA): string {
	// Round RGB values to avoid float sub-pixel rendering issues, keep Alpha float
	return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a.toFixed(3)})`;
}
