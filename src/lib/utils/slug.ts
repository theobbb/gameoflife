export function slugify(name: string): string {
	if (!name) return '';

	return name
		.normalize('NFD') // Decouple accents
		.replace(/[\u0300-\u036f]/g, '') // Strip accent marks
		.toLowerCase()
		.replace(/[^a-z0-9.]/g, ''); // Remove everything except letters, numbers, and dots
}
