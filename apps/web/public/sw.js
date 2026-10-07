/*
 * CriptEnv — service worker intencionalmente vazio.
 *
 * Nenhum código do aplicativo registra um service worker, mas requisições por
 * `/sw.js` chegam mesmo assim (registros antigos em browsers de visitantes e
 * extensões que sondam o caminho). Antes deste arquivo existir, essas
 * requisições não encontravam rota e viravam um erro no worker.
 *
 * Deliberadamente SEM handler de `fetch`: um service worker sem `fetch` não
 * intercepta nenhuma requisição, então este arquivo é inofensivo — ele apenas
 * dá uma resposta válida (e permite que um registro antigo seja substituído e
 * depois desregistrado com `registration.unregister()`).
 *
 * Se um service worker real for introduzido no futuro (ex.: cache offline),
 * substitua este arquivo por uma implementação com versionamento de cache.
 */

self.addEventListener("install", () => {
  // Não precisa de pré-cache: pula direto para a ativação.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpa caches legados de qualquer service worker anterior.
      if (self.caches && self.caches.keys) {
        const keys = await self.caches.keys();
        await Promise.all(keys.map((key) => self.caches.delete(key)));
      }
      await self.registration.unregister();
    })(),
  );
});
