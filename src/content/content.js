(async () => {
  const api = globalThis.browser ?? globalThis.chrome;
  const { start } = await import(api.runtime.getURL('content/main.js'));
  await start();
})().catch((error) => {
  // seul point de diagnostic si l import dynamique echoue : sans lui la page
  // reste muette et la panne n est attribuable a rien
  console.error('Warhadex : chargement du script de contenu impossible', error);
});
