// Reusable pagination for record tables. Key/value detail tables stay intact.
export function pageWindow(total, requestedPage = 1, requestedSize = 10) {
  const size = [10, 25, 50, 100].includes(Number(requestedSize)) ? Number(requestedSize) : 10;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.max(1, Math.min(pages, Math.trunc(Number(requestedPage)) || 1));
  const offset = (page - 1) * size;
  return { page, size, pages, offset, end: Math.min(offset + size, total), first: total ? offset + 1 : 0, total };
}

export function initializeTablePagination(root = document) {
  const template = document.getElementById("tablePaginationTemplate");
  if (!template) return;
  root.querySelectorAll("table").forEach(table => {
    if (!table.tHead || !table.tBodies.length || table.dataset.paginated || table.dataset.pagination === "false") return;
    table.dataset.paginated = "true";
    const rows = Array.from(table.tBodies).flatMap(body => Array.from(body.rows)).filter(row => !row.querySelector("td.empty"));
    const controls = template.content.firstElementChild.cloneNode(true);
    const heading = table.closest("section")?.querySelector("h2")?.textContent.trim() || "Records";
    controls.setAttribute("aria-label", heading + " pagination");
    const selector = controls.querySelector("[data-page-size]");
    const summary = controls.querySelector("[data-page-summary]");
    const position = controls.querySelector("[data-page-position]");
    const buttons = Array.from(controls.querySelectorAll("[data-page-action]"));
    let state = pageWindow(rows.length);
    function render() {
      state = pageWindow(rows.length, state.page, state.size);
      rows.forEach((row, index) => row.classList.toggle("pagination-hidden", index < state.offset || index >= state.end));
      summary.textContent = `Showing ${state.first}–${state.end} of ${state.total} records`;
      position.textContent = `Page ${state.page} of ${state.pages}`;
      buttons.forEach(button => {
        button.disabled = ["first", "previous"].includes(button.dataset.pageAction) ? state.page === 1 : state.page === state.pages;
      });
    }
    selector.addEventListener("change", () => {
      state = pageWindow(rows.length, 1, selector.value);
      render();
    });
    buttons.forEach(button => button.addEventListener("click", () => {
      const next = { first: 1, previous: state.page - 1, next: state.page + 1, last: state.pages }[button.dataset.pageAction];
      state = pageWindow(rows.length, next, state.size);
      render();
    }));
    const wrapper = table.closest(".table-wrap");
    (wrapper || table).insertAdjacentElement("afterend", controls);
    render();
  });
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => initializeTablePagination(), { once: true });
  else initializeTablePagination();
}
