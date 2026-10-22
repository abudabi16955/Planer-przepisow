/** The first install claims clients silently; subsequent versions reload once. */
export function registerServiceWorker(
  reload = () => window.location.reload(),
): void {
  if (!('serviceWorker' in navigator)) return;
  let hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (!refreshing) {
      refreshing = true;
      reload();
    }
  });
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => {
      const update = () => {
        void registration.update().catch(() => {});
      };
      window.addEventListener('focus', update);
      update();
    })
    .catch(() => {
      /* Offline or unsupported registration must not prevent the app from loading. */
    });
}
