/**
 * home.js
 *
 * The 3-column tile grid. Adding a module later means adding one entry
 * to TILES - the grid, spacing and layout already support up to 12
 * without any other changes.
 */

const OrbitHome = (() => {
  const TILES = [
    { route: "soon", label: "Soon", icon: "soon" },
    { route: "upcoming", label: "Upcoming", icon: "upcoming" },
    { route: "routines", label: "Routines", icon: "routines" },
    { route: "tasks", label: "Tasks", icon: "tasks" },
    { route: "shopping", label: "Shopping", icon: "shopping" },
    { route: "lists", label: "Lists", icon: "lists" },
    { route: "calendar", label: "Calendar", icon: "calendar" },
    { route: "waiting", label: "Waiting", icon: "waiting" },
  ];

  function render(root, header) {
    OrbitUI.renderHomeHeader(header);

    const grid = document.createElement("div");
    grid.className = "home-grid";

    TILES.forEach((tile) => {
      const btn = document.createElement("button");
      btn.className = "tile";
      btn.innerHTML = `
        <span class="tile-icon">${OrbitIcons.get(tile.icon)}</span>
        <span class="tile-label">${tile.label}</span>
      `;
      btn.addEventListener("click", () => OrbitRouter.navigate(`/${tile.route}`));
      grid.appendChild(btn);
    });

    root.appendChild(grid);
  }

  return { render };
})();

OrbitRouter.register("home", OrbitHome.render);
