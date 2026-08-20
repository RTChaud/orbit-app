/**
 * settings.js
 *
 * Small utility screen (a modal, not a full route) for backing up and
 * restoring Orbit's data - opened from a gear icon on the home header.
 */

const OrbitSettings = (() => {
  function openBackupModal() {
    const wrap = document.createElement("div");
    wrap.className = "form";

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn btn-primary";
    exportBtn.textContent = "Export data";
    exportBtn.addEventListener("click", handleExport);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.hidden = true;
    fileInput.addEventListener("change", handleImportFile);

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "btn btn-secondary";
    importBtn.textContent = "Import data";
    importBtn.addEventListener("click", () => fileInput.click());

    const note = document.createElement("p");
    note.className = "empty-hint";
    note.textContent = "Importing a file replaces all current Orbit data - it doesn't merge with what's already here.";

    wrap.appendChild(exportBtn);
    wrap.appendChild(importBtn);
    wrap.appendChild(fileInput);
    wrap.appendChild(note);

    OrbitUI.openModal("Settings", wrap);
  }

  function handleExport() {
    const data = OrbitBackup.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orbit-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleImportFile(event) {
    const file = event.target.files[0];
    event.target.value = ""; // so selecting the same file again still fires "change"
    if (!file) return;

    const confirmed = window.confirm(
      "This replaces all current Orbit data with the contents of this file. This can't be undone. Continue?"
    );
    if (!confirmed) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        OrbitBackup.importData(data);
        window.location.reload();
      } catch (err) {
        console.error("Orbit: import failed", err);
        window.alert("That file couldn't be read as an Orbit backup.");
      }
    };
    reader.readAsText(file);
  }

  return { openBackupModal };
})();
