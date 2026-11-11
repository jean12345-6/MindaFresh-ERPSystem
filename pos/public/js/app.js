// POS front-end helpers: SweetAlert toasts, confirm dialogs, image-only uploads, mobile sidebar.
(function () {
  const COLORS = { confirmButtonColor: "#C2410C", cancelButtonColor: "#6B4F3F" };
  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const MAX_MB = 3;

  const toast = Swal.mixin({
    toast: true, position: "top-end", showConfirmButton: false, timer: 3800, timerProgressBar: true,
    didOpen: (el) => { el.addEventListener("mouseenter", Swal.stopTimer); el.addEventListener("mouseleave", Swal.resumeTimer); }
  });
  window.notify = (icon, title) => toast.fire({ icon, title });

  document.addEventListener("DOMContentLoaded", () => {
    // Server flash messages -> toasts
    const f = window.__flash || {};
    (f.success || []).forEach((m) => window.notify("success", m));
    (f.error || []).forEach((m) => Swal.fire({ icon: "error", title: "Something is off", text: m, confirmButtonText: "OK", ...COLORS }));

    // Mobile sidebar
    const side = document.getElementById("sidebar"), scrim = document.getElementById("scrim");
    const setMenu = (open) => { side?.classList.toggle("-translate-x-full", !open); scrim?.classList.toggle("hidden", !open); };
    document.getElementById("menuBtn")?.addEventListener("click", () => setMenu(true));
    scrim?.addEventListener("click", () => setMenu(false));

    // <form data-confirm="Question?" data-confirm-button="Yes" data-confirm-danger="1">
    document.addEventListener("submit", async (e) => {
      const form = e.target.closest("form[data-confirm]");
      if (!form || form.dataset.confirmed) return;
      e.preventDefault();
      const r = await Swal.fire({
        icon: "question", title: form.dataset.confirm, showCancelButton: true,
        confirmButtonText: form.dataset.confirmButton || "Yes", cancelButtonText: "Cancel", reverseButtons: true, ...COLORS,
        ...(form.dataset.confirmDanger ? { confirmButtonColor: "#B42318" } : {})
      });
      if (r.isConfirmed) { form.dataset.confirmed = "1"; form.requestSubmit(); }
    });

    // <input type="file" data-image data-preview="#imgId"> : images only (png, jpg, webp, gif), max 3 MB
    document.querySelectorAll("input[type=file][data-image]").forEach((input) => {
      input.setAttribute("accept", IMAGE_TYPES.join(","));
      // Chrome/Edge: the File System Access picker can hide the "All Files" choice. Other browsers fall back to the normal dialog.
      if (window.showOpenFilePicker) {
        input.addEventListener("click", async (e) => {
          e.preventDefault();
          try {
            const [handle] = await window.showOpenFilePicker({
              multiple: false, excludeAcceptAllOption: true,
              types: [{ description: "Images (PNG, JPG, WEBP, GIF)", accept: {
                "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg", ".jfif", ".jpe", ".pjpeg", ".pjp"], "image/webp": [".webp"], "image/gif": [".gif"] } }]
            });
            const dt = new DataTransfer();
            dt.items.add(await handle.getFile());
            input.files = dt.files;
            input.dispatchEvent(new Event("change"));
          } catch { /* picker cancelled */ }
        });
      }
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        let problem = "";
        if (!IMAGE_TYPES.includes(file.type)) problem = "Only image files are allowed (PNG, JPG, WEBP or GIF).";
        else if (file.size > MAX_MB * 1024 * 1024) problem = `The image must be ${MAX_MB} MB or smaller.`;
        if (problem) {
          input.value = "";
          Swal.fire({ icon: "error", title: "Cannot upload this file", text: problem, ...COLORS });
          return;
        }
        const prev = document.querySelector(input.dataset.preview);
        if (prev) { prev.src = URL.createObjectURL(file); prev.classList.remove("hidden"); }
        const name = document.querySelector(input.dataset.name);
        if (name) name.textContent = file.name;
      });
    });
  });
})();
