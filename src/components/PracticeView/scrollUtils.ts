/**
 * Calculates the scroll percentage of an element.
 * Returns a value between 0 and 1 representing how far the element is scrolled.
 * Returns 0 if the content is not scrollable (scrollHeight <= clientHeight).
 */
export function calculateScrollPercentage(element: HTMLElement): number {
  const { scrollTop, scrollHeight, clientHeight } = element;
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return 0;
  return Math.min(Math.max(scrollTop / maxScroll, 0), 1);
}

/**
 * Restores the scroll position of an element based on a percentage value.
 * Clamps the target scroll position to the maximum scrollable range.
 */
export function restoreScrollPosition(element: HTMLElement, percentage: number): void {
  const maxScroll = element.scrollHeight - element.clientHeight;
  const targetScroll = Math.min(percentage * maxScroll, maxScroll);
  element.scrollTop = targetScroll;
}
