import { slugify } from './utils/slug';

export const groups = [
	{
		name: 'Still Life',
		description: `un motif non vide qui ne change pas d’une génération à la suivante`,
		theme: 'green',
		children: [
			'block',
			'tub',
			'boat',
			'beehive',
			'ship',
			'eater 1',
			'loaf',
			'canoe',
			'pond',
			'hat',
			'integral sign',
			'boat-tie',
			'loop',
			'elevener',
			'honeycomb',
			'mirrored table'
		]
	},
	{
		name: 'Oscillator',
		description: `un motif qui se répète après un nombre fixe de générations (appelé sa période)`,
		theme: 'light-blue',
		children: [
			'blinker',
			'toad',
			'beacon',
			'pulsar',
			'pinwheel',
			'octagon 2',
			'$rats',
			'burloaferimeter',
			'figure eight',
			'worker bee',
			'42p10.3',
			'38p11.1',
			'dinner table',
			`65p13.1`,
			'tumbler',
			'pentadecathlon',
			'twoprelhasslers',
			'54p17.1',
			'117p18',
			'cribbage',
			'transqueenbeeshuttle'
		]
	},
	{
		name: 'Spaceship',
		description: `un motif fini qui se déplace à travers la grille de cellules et se répète après un nombre fixe de générations`,
		theme: 'dark-blue',
		children: [
			'glider',
			'lwss',
			'mwss',
			'hwss'
			// '25P3H1V0.1',
			// 'loafer',
			// 'weekender',
			// 'copperhead',
			// 'turtle',
			// '58P5H1V1',
			// '77P6H1V1',
			// '30P5H2V0',
			// '114p6h1v0',
			// 'diagonal spaceship'
		]
	},
	{
		name: 'Gun',
		description: `un motif stationnaire qui émet continuellement des vaisseaux (ou des râteaux)`,
		theme: 'yellow',
		children: [
			'gosperglidergun',
			'simkinglidergun',
			'twinbeesshuttle',
			'newgun'
			// 'period46glidergun',
			// 'snark-based glider gun'
		]
	},
	// {
	// 	name: 'Breeder',
	// 	description: `a pattern that exhibits unbounded quadratic growth`,
	// 	children: ['switch engine breeder', 'spacerake breeder', 'metacatacryst']
	// },
	{
		name: 'Methuselah',
		theme: 'purple',
		description: `un motif qui met un grand nombre de générations à se stabiliser (appelé sa durée de vie) et qui devient beaucoup plus grand que sa configuration initiale`,
		children: ['rpentomino', 'acorn', 'diehard', 'bunnies', 'piheptomino']
	}
	// {
	// 	name: 'Puffer',
	// 	description: `a pattern that moves like a spaceship, except that it leaves debris behind`,
	// 	children: ['puffer 1', 'puffer 2', 'puffer train', 'blinker puffer', 'zigzag puffer']
	// },
	// {
	// 	name: 'Rake',
	// 	description: `a puffer whose debris consists of spaceships`,
	// 	children: ['space rake', 'glider rake', 'twin bees shuttle rake']
	// },
	// {
	// 	name: 'Gun',
	// 	description: `a stationary pattern that repeatedly emits spaceships (or rakes) forever`,
	// 	children: [
	// 		'gosper glider gun',
	// 		'simkin glider gun',
	// 		'twin bees shuttle',
	// 		'new gun',
	// 		'period-46 glider gun',
	// 		'snark-based glider gun'
	// 	]
	// },
	// {
	// 	name: 'Breeder',
	// 	description: `a pattern that exhibits unbounded quadratic growth`,
	// 	children: ['switch engine breeder', 'spacerake breeder', 'metacatacryst']
	// },
	// {
	// 	name: 'Conduit',
	// 	description: `an arrangement of still lifes and/or oscillators that move an active object to another location without suffering any permanent damage`,
	// 	children: ['herschel conduit', 'fx176', 'fx77', 'snark', 'stable reflector']
	// },
	// {
	// 	name: 'Methuselah',
	// 	description: `a pattern that takes a large number of generations to stabilize (known as its lifespan) and becomes much larger than its initial configuration at some point during its evolution`,
	// 	children: ['r-pentomino', 'acorn', 'diehard', 'bunnies', 'pi-heptomino']
	// },
	// {
	// 	name: 'Soup',
	// 	description: `a pattern made by randomly putting cells in an area`,
	// 	children: ['random soup', 'ash soup', 'catagolue soup']
	// },
	// {
	// 	name: 'Synthesis',
	// 	description: `a way to make another pattern by crashing spaceships into each other`,
	// 	children: ['glider synthesis', 'lwss synthesis', 'herschel synthesis', 'one-time turner']
	// }
];

export const navigation = (() => {
	const map = new Map<
		string,
		{
			slug: string;
			group: string;
			theme: string;
			index: number;
			prev: string | null;
			next: string | null;
		}
	>();

	// 1. Flatten all children into a single list with their group names
	const flatList = [...groups].flatMap((group) =>
		group.children.map((name, i) => ({
			name,
			group: group.name,
			theme: group.theme,
			index: i
		}))
	);

	// 2. Map through the flat list to link global neighbors
	flatList.forEach((item, index) => {
		const prevItem = flatList[index - 1];
		const nextItem = flatList[index + 1];

		// We use name_to_slug(item.name) as the key for the map
		// to ensure the UI can look it up via the URL slug
		map.set(slugify(item.name), {
			slug: slugify(item.name),
			group: item.group,
			theme: item.theme,
			index: item.index,
			prev: prevItem ? slugify(prevItem.name) : null,
			next: nextItem ? slugify(nextItem.name) : null
		});
	});

	return map;
})();
