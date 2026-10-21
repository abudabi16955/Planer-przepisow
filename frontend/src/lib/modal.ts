/** Focus and scroll management shared by planner sheets and desktop dialogs. */
export function modalFocus(
  node: HTMLElement,
  options: { close: () => void; locked: () => boolean },
) {
  const previous = document.activeElement as HTMLElement | null;
  const context = previous?.closest('[role=group]');
  const overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  node.querySelector<HTMLButtonElement>('button')?.focus();
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !options.locked()) options.close();
    if (event.key !== 'Tab') return;
    const targets = [
      ...node.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
      ),
    ];
    const first = targets[0],
      last = targets[targets.length - 1];
    if (!first) {
      event.preventDefault();
      node.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  node.addEventListener('keydown', keydown);
  return {
    destroy() {
      document.body.style.overflow = overflow;
      node.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
      else
        context?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    },
  };
}
