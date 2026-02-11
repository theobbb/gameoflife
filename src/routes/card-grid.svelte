<script lang="ts">
	import type { Pattern } from '$lib/types';
	let {
		pattern: raw_pattern
	}: {
		pattern: Pattern;
	} = $props();
	const { pattern, width, height } = $derived(raw_pattern);
	let canvas: HTMLCanvasElement;
	const GAP = 0.05;

	function draw() {
		if (!canvas || !pattern?.length) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Get actual displayed size
		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		// Make canvas sharp - set backing store size
		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;

		// Scale context to match DPR
		ctx.scale(dpr, dpr);

		// Work in CSS pixels from here on
		const canvasWidth = rect.width;
		const canvasHeight = rect.height;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		// Calculate cell size that preserves aspect ratio
		const aspectRatio = width / height;
		let drawWidth,
			drawHeight,
			offsetX = 0,
			offsetY = 0;

		if (aspectRatio >= 1) {
			// Width is greater or equal - fit to width
			drawWidth = canvasWidth;
			drawHeight = canvasWidth / aspectRatio;
			offsetY = (canvasHeight - drawHeight) / 2;
		} else {
			// Height is greater - fit to height
			drawHeight = canvasHeight;
			drawWidth = canvasHeight * aspectRatio;
			offsetX = (canvasWidth - drawWidth) / 2;
		}

		const cellWidth = drawWidth / width;
		const cellHeight = drawHeight / height;
		const gap = Math.min(cellWidth, cellHeight) * GAP;

		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				const x = offsetX + col * cellWidth;
				const y = offsetY + row * cellHeight;

				if (pattern[row]?.[col]) {
					ctx.fillRect(x + gap, y + gap, cellWidth - gap * 2, cellHeight - gap * 2);
				}
			}
		}
	}

	$effect(() => {
		draw();
		return () => {
			if (canvas) {
				const ctx = canvas.getContext('2d');
				if (ctx) {
					// Clear the canvas
					ctx.clearRect(0, 0, canvas.width, canvas.height);
				}
				// Reset canvas size to free memory
				canvas.width = 0;
				canvas.height = 0;
			}
		};
	});
</script>

<canvas class="aspect-square w-full opacity-50" bind:this={canvas}></canvas>
