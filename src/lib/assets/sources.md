## Ressources

### Jeu de la vie

(pas explicitement citées mais utilisées comme inspiration)

- https://conwaylife.com/wiki/ → Le wiki dédié au Jeu de la vie le plus complet et élaboré que j'ai trouvé. D'ailleurs, c’est ici que j'ai réussi à extraire les structures. Si seulement ce cher Wiki n’était pas protégé par un _anti-scraper_ de Cloudflare, j’aurais pu extraire TOUTES les structures 😓.
- https://conwaylife.com/ → Le moteur de jeu du même wiki.
- https://playgameoflife.com/ → Un moteur de jeu minimaliste. Probablement le seul que j'ai trouvé où on voit qu’il y a eu un réel effort de design. Les règles sont bien présentées. C'est ici que j’ai trouvé de l’inspiration pour la première présentation des règles condensée que j'ai faite.
- https://en.wikipedia.org/wiki/Conway's_Game_of_Life → La page Wikipedia.
- https://conwaylife.appspot.com/library/ → Une liste des structure - mais franchement pas très utile puisqu’on peut seulement consulter les structure en ordre alphabétique ou bien en utilisant le _search bar_...
- https://copy.sh/life/examples/ → Une autre liste de structure et le même problème qu'en haut. J'essayais simplement de contourner Cloudflare.
- https://life.angen.ai/blog/15-most-important-game-of-life-patterns-that-changed-everything → Ça c’était utile, j'ai éventuellement abandonner l'idée de lister TOUTES les structures. À ce moment là, je me suis concentré sur les structures les plus importantes à présenter. Il s'agit à la base d'un site web informatif donc c'est dans le même esprit. Aussi, après avoir refais les règles, le site s'adresse encore plus qu'avant aux initiés du Jeu de la vie.

---

- https://www.youtube.com/watch?v=eMn43As24Bo (par EGO) → Vidéo YouTube très bien réalisée. Comme je l'explique à la semaine 4, ça m'a énormément aidé à structurer la présentation des règles. Visuellement et chronologiquement.

### Autres

- https://www.youtube.com/watch?v=rSKMYc1CQHE (par Sebastian Lague) → SUPERBE VIDÉO. Je recommande à tout le monde d'aller voir cette chaîne YouTube, c'est une mine d'or. Je n'ai pas directement utilisé les mêmes techniques, mais disons que c'est de là que vient mon inspiration depuis le début.

## Design

Mise à part les différents moteurs de jeu que l'on trouve en ligne et qui sont référencés plus haut, la _DA_ s'est vraiment faite toute seule. De façon très organique. Haha... get it? Organique.

### Typographie

Une nonne vieille typo Google.

- [Syne](https://fonts.google.com/specimen/Syne?query=syne)
- [Syne Mono](https://fonts.google.com/specimen/Syne+Mono?query=syne)

Mon inspiration pour la typo: ce site web qui n'est vraiment pas relié au sujet.
https://www.fuse.kiwi/
Je sais pas... je trouvais que ça faisait organique. Et assez expérimental. Surtout la version mono.

### Icones

- [Iconify](https://iconify.design/) (la meilleure librairie) → [Remix icons](https://remixicon.com/) (sous-librairie utilisée)

## Stack

- ❤️❤️❤️❤️❤️ ∞ [SvelteKit](https://svelte.dev/) mon bébé d'amour
- ❤️❤️❤️ [Tailwind](https://tailwindcss.com/)
- ❤️ [Coolify](https://coolify.io/)

### Dépendances package.json

```json
{
	"name": "life",
	"private": true,
	"version": "0.0.1",
	"type": "module",
	"engines": {
		"node": ">= 22"
	},
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"prepare": "svelte-kit sync || echo ''",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
		"lint": "prettier --check .",
		"format": "prettier --write ."
	},
	"devDependencies": {
		"@iconify/json": "^2.2.431",
		"@iconify/tailwind4": "^1.2.1",
		"@sveltejs/adapter-node": "^5.5.2",
		"@sveltejs/kit": "^2.50.2",
		"@sveltejs/vite-plugin-svelte": "^6.2.4",
		"@tailwindcss/vite": "^4.1.18",
		"prettier": "^3.8.1",
		"prettier-plugin-svelte": "^3.4.1",
		"prettier-plugin-tailwindcss": "^0.7.2",
		"svelte": "^5.49.2",
		"svelte-check": "^4.3.6",
		"tailwindcss": "^4.1.18",
		"typescript": "^5.9.3",
		"vite": "^7.3.1"
	},
	"dependencies": {
		"marked": "^17.0.3"
	}
}
```

## Intelligence artificielle

L'intelligence artificielle a été utilisé dans ce projet.

- https://claude.ai
- https://gemini.google.com

Mais pour aucun design, conception ni développement. Elle a seulement servie à optimiser le _physics engine_.
