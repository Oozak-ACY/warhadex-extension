// Chrome expose chrome, Firefox et Safari exposent browser
const api = globalThis.browser ?? globalThis.chrome;

export default api;
