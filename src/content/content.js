(async () => {
  const api = globalThis.browser ?? globalThis.chrome;
  const { start } = await import(api.runtime.getURL('content/main.js'));
  await start();
})();
