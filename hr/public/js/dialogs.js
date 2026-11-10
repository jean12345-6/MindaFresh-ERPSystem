// Page enhancement only. Records and permissions are handled on the server.
document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () =>
    document.getElementById(button.dataset.open)?.showModal(),
  );
});
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog")?.close());
});
document.querySelectorAll("[data-print]").forEach((button) => {
  button.addEventListener("click", () => window.print());
});
document.querySelectorAll("form[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

document.querySelectorAll("[data-print]").forEach(button => button.addEventListener("click", () => window.print()));
