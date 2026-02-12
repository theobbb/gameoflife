<script>
	import Key from '$lib/ui/key.svelte';
	import { get_engine } from '../../engine.svelte';

	const engine = get_engine();
</script>

<div class="flex items-end gap-gap">
	<button onclick={engine.togglePlay} class="w-44">
		<Key label="play/pause">
			<div class="h-0.5 w-10 -translate-y-2 bg-text"></div>
		</Key>
		<!-- <div class={[engine.isPlaying ? 'icon-[ri--pause-fill]' : 'icon-[ri--play-fill]']}></div> -->
	</button>
	<div class="grid grid-cols-3 grid-rows-2 gap-x-1.5">
		<button onclick={engine.next_frame} class="col-start-2 w-11">
			<Key label="time+">
				<div class={'icon-[ri--arrow-up-fill] -translate-y-2'}></div>
			</Key>
		</button>
		<button onclick={engine.next_frame} class="row-start-2 w-11">
			<Key label="gen-">
				<div class={'icon-[ri--arrow-left-fill] -translate-x-2 -translate-y-2'}></div>
			</Key>
		</button>
		<button onclick={engine.next_frame} class="row-start-2 w-11">
			<Key label="Time-">
				<div class={'icon-[ri--arrow-down-fill] -translate-y-2'}></div>
			</Key>
		</button>
		<button onclick={engine.next_frame} class="row-start-2 w-11">
			<Key label="Gen+">
				<div class={'icon-[ri--arrow-right-fill] translate-x-2 -translate-y-2'}></div>
			</Key>
		</button>
	</div>
	<!-- <div>
					<div class="relative flex w-fit flex-col items-center justify-center">
						<div class="size-10 rounded-xl border-2 opacity-30"></div>
						<div
							class="absolute icon-[ri--cursor-fill] translate-x-0.5 translate-y-1 text-2xl"
						></div>
					</div>
					<span class="font-mono text-xs">cells</span>
				</div> -->
</div>
