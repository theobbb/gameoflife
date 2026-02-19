<script>
	import './markdown.css';
	import content from '$lib/assets/recherche.md?raw';
	import { marked } from 'marked';

	const renderer = new marked.Renderer();

	// Override the default image renderer
	renderer.image = ({ href, title, text }) => {
		const isVideo = href.toLowerCase().endsWith('.mp4') || href.toLowerCase().endsWith('.webm');

		if (isVideo) {
			return `
                <video controls class="w-full rounded-lg my-4">
                    <source src="${href}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
		}

		// Return standard image tag for everything else
		return `<img src="${href}" alt="${text}" title="${title || ''}" />`;
	};

	// Pass the custom renderer to marked
	const markdown = marked.parse(content, { renderer });
	//const markdown = marked(content);
</script>

<div>
	<a href="/">← Retour</a>
</div>
<div class="mx-auto my-12 max-w-2xl">
	<div class="markdown">{@html markdown}</div>
</div>
