/**
 * router.js
 *
 * A single <main id="view-root"> is repainted based on the URL hash, e.g.
 * '#/soon', '#/lists/<id>'. Each module registers itself with a render
 * function; the router just dispatches, it knows nothing about module
 * internals.
 */

const OrbitRouter = (() => {
  const routes = {};
  let root = null;
  let header = null;

  function register(name, renderFn) {
    routes[name] = renderFn;
  }

  function navigate(path) {
    window.location.hash = path;
  }

  function back() {
    navigate("/");
  }

  function parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    return { name: parts[0] || "home", params: parts.slice(1) };
  }

  function renderCurrent() {
    const { name, params } = parseHash();
    const renderFn = routes[name] || routes.home;
    root.innerHTML = "";
    renderFn(root, header, params);
    root.scrollTop = 0;
  }

  function init(rootEl, headerEl) {
    root = rootEl;
    header = headerEl;
    window.addEventListener("hashchange", renderCurrent);
    renderCurrent();
  }

  return { register, navigate, back, init, renderCurrent };
})();
