// +page.server.ts
import { error } from '@sveltejs/kit';
import { renderer } from './renderer';
export const prerender = true;

const files = import.meta.glob('/src/lib/assets/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

const routes = [
	{ name: 'Aperçu', slug: '' },
	{ name: 'Semaine 1', slug: 'semaine-1' },
	{ name: 'Semaine 2', slug: 'semaine-2' },
	{ name: 'Semaine 3', slug: 'semaine-3' },
	{ name: 'Semaine 4', slug: 'semaine-4' },
	{ name: 'Sources', slug: 'sources' }
];

export async function load({ params }) {
	const slug = params.file ?? '';
	const route = routes.find((r) => r.slug === slug);
	if (!route) error(404);

	const filename = slug || 'recherche';
	const raw = files[`/src/lib/assets/${filename}.md`];
	if (!raw) error(404);

	const { markdown, headings } = renderer(`# ${route.name}\n\n${raw}`);

	return { markdown, headings, routes, current: route };
}
