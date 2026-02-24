import { marked } from 'marked';

export type Heading = {
	id: string;
	text: string;
	depth: number;
};
export function renderer(content: string) {
	content = content.replace(/!\[\[([^\]]+)\]\]/g, (_, filename) => {
		return `![](/attachments/${encodeURIComponent(filename)})`;
	});

	const renderer = new marked.Renderer();
	const headings: Heading[] = [];

	renderer.heading = ({ text, depth }) => {
		const id = text.toLowerCase().replace(/[^\w]+/g, '-');
		headings.push({ id, text, depth });
		return `<h${depth} id="${id}" style="scroll-margin: 3rem;">${text}</h${depth}>`;
	};

	// Override the default image renderer
	renderer.image = ({ href, title, text }) => {
		const filename = href.split('/').pop();
		href = `/attachments/${filename}`;

		const isVideo = href.toLowerCase().endsWith('.mp4') || href.toLowerCase().endsWith('.webm');

		if (isVideo) {
			return `
                <video controls>
                    <source src="${href}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
		}

		// Return standard image tag for everything else
		return `<img src="${href}" alt="${text}" title="${title || ''}" />`;
	};
	return { markdown: marked.parse(content, { renderer }), headings };
}
