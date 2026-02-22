/**
 * Custom hook/utility to simplify the use of the Intersection Observer API.
 *
 * It automatically handles observer creation, observation, and necessary cleanup
 * (disconnecting the observer when no longer needed).
 *
 * @param targetElement - The DOM Element or a function that returns the DOM Element to observe.
 * If a function is provided, the observation will start once the element is available.
 * @param callback - The function to execute when the intersection status changes.
 * @param options - Optional configuration for the Intersection Observer (root, rootMargin, threshold).
 * @returns A cleanup function that can be called manually to stop observing and disconnect the observer.
 */
type ElementGetter = () => HTMLElement | null;
type Target = HTMLElement | ElementGetter | null;

type IntersectionCallback = (
	entry: IntersectionObserverEntry,
	observer: IntersectionObserver
) => void;

interface IntersectionObserverOptions {
	root?: HTMLElement | null;
	rootMargin?: string;
	threshold?: number | number[];
}

export function useIntersectionObserver(
	targetElement: Target,
	callback: IntersectionCallback,
	options: IntersectionObserverOptions = {}
): () => void {
	// Use a variable to hold the observer instance.
	let observer: IntersectionObserver | null = null;
	let elementToObserve: HTMLElement | null = null;

	try {
		// 1. Determine the element to observe
		if (typeof targetElement === 'function') {
			elementToObserve = targetElement();
		} else {
			elementToObserve = targetElement;
		}

		if (!elementToObserve) {
			// If the element is null, warn the developer but do nothing.
			// This is common in modern frameworks where the ref might be null initially.
			console.warn('IntersectionObserver target element is currently null.');
			// Return a no-op cleanup function
			return () => {};
		}

		// 2. Define the observer logic
		const handler: IntersectionObserverCallback = (entries, observerInstance) => {
			entries.forEach((entry) => {
				// We only care about the entry that is currently intersecting or has intersected
				if (entry.target === elementToObserve) {
					callback(entry, observerInstance);
				}
			});
		};

		// 3. Create and configure the observer
		observer = new IntersectionObserver(handler, options);

		// 4. Start observing the target element
		observer.observe(elementToObserve);
	} catch (error) {
		console.error('Failed to initialize Intersection Observer:', error);
		// Ensure the cleanup function is still returned even if initialization fails
		return () => {
			if (observer) {
				observer.disconnect();
				observer = null;
			}
		};
	}

	// 5. Return the cleanup function
	const cleanup = () => {
		if (observer && elementToObserve) {
			observer.unobserve(elementToObserve);
			observer.disconnect();
			observer = null;
		}
	};

	return cleanup;
}
