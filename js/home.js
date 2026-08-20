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

      const iconSlot = document.createElement("span");
      iconSlot.className = "tile-icon-slot";

      // Each module can have its own logo later: icons/<route>.webp. If it
      // doesn't exist yet, this quietly falls back to the line icon -
      // adding a logo later is just dropping the file in, no code change.
      const img = document.createElement("img");
      img.src = `icons/${tile.route}.webp`;
      img.alt = "";
      img.className = "tile-icon-img";
      img.addEventListener("error", () => {
        iconSlot.classList.add("tile-icon");
        iconSlot.innerHTML = OrbitIcons.get(tile.icon);
      });
      iconSlot.appendChild(img);

      const label = document.createElement("span");
      label.className = "tile-label";
      label.textContent = tile.label;

      btn.appendChild(iconSlot);
      btn.appendChild(label);
      btn.addEventListener("click", () => OrbitRouter.navigate(`/${tile.route}`));
      grid.appendChild(btn);
    });

    root.appendChild(grid);
  }

  return { render };
})();

OrbitRouter.register("home", OrbitHome.render);
