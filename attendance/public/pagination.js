/* MindaFresh Attendance - shared table pagination
 *
 * 1. window.pageList(current, total)
 *    Returns the page numbers to show, with "…" for the gaps,
 *    for example [1, "…", 4, 5, 6, "…", 70]. Used by DTR and Summary.
 *
 * 2. Auto pagination for any <tbody data-paginate="10">.
 *    Rows with data-no-paginate (like the "no records" row) are left alone.
 *    A pager (info text + buttons) is added after the table's card.
 */
(() => {
  "use strict";

  function pageList(current, total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = [1];
    let start = Math.max(2, current - 1);
    let end = Math.min(total - 1, current + 1);

    if (current <= 3) end = 4;
    if (current >= total - 2) start = total - 3;

    if (start > 2) pages.push("…");
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < total - 1) pages.push("…");

    pages.push(total);
    return pages;
  }

  window.pageList = pageList;

  const css = `
    .mf-pager { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;
      gap:12px; margin-top:16px; padding-top:14px; border-top:1px solid #f0e4dc; }
    .mf-pager-info { color:#846a5c; font-size:12px; }
    .mf-pager-buttons { display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
    .mf-pager-btn { min-width:35px; height:35px; padding:0 11px; border:1px solid #ead7cb;
      border-radius:8px; background:#fff; color:#684a3b; font:inherit; font-size:12px;
      font-weight:700; cursor:pointer; }
    .mf-pager-btn:hover:not(:disabled) { background:#fff0e6; border-color:#cf3b00; color:#cf3b00; }
    .mf-pager-btn.active { background:#cf3b00; border-color:#cf3b00; color:#fff; }
    .mf-pager-btn:disabled { opacity:.4; cursor:not-allowed; }
    .mf-pager-gap { padding:0 4px; color:#846a5c; font-weight:700; }
    @media print { .mf-pager { display:none; } [data-paginate] tr { display:table-row !important; } }
  `;

  function addStyle() {
    if (document.getElementById("mf-pager-style")) return;
    const style = document.createElement("style");
    style.id = "mf-pager-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function setup(tbody) {
    const perPage = Math.max(1, Number(tbody.dataset.paginate) || 10);
    const label = tbody.dataset.paginateLabel || "records";
    const rows = Array.from(tbody.rows).filter(
      r => !r.hasAttribute("data-no-paginate")
    );

    const total = rows.length;
    if (total <= perPage) return;

    addStyle();

    const totalPages = Math.ceil(total / perPage);
    let current = 1;

    const pager = document.createElement("div");
    pager.className = "mf-pager";
    pager.innerHTML =
      '<div class="mf-pager-info"></div><div class="mf-pager-buttons"></div>';

    const anchor = tbody.closest(".card") || tbody.closest("table");
    anchor.appendChild(pager);

    const info = pager.querySelector(".mf-pager-info");
    const buttons = pager.querySelector(".mf-pager-buttons");

    function button(text, page, disabled, active) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mf-pager-btn" + (active ? " active" : "");
      b.textContent = text;
      b.disabled = disabled;
      if (active) b.setAttribute("aria-current", "page");
      b.addEventListener("click", () => {
        if (disabled || page === current) return;
        current = page;
        render();
      });
      buttons.appendChild(b);
    }

    function render() {
      const start = (current - 1) * perPage;
      const end = Math.min(start + perPage, total);

      rows.forEach((row, i) => {
        row.style.display = i >= start && i < end ? "" : "none";
      });

      info.textContent =
        "Showing " + (start + 1) + "–" + end + " of " + total + " " + label;

      buttons.innerHTML = "";
      button("Previous", current - 1, current === 1, false);
      pageList(current, totalPages).forEach(p => {
        if (p === "…") {
          const gap = document.createElement("span");
          gap.className = "mf-pager-gap";
          gap.textContent = "…";
          buttons.appendChild(gap);
        } else {
          button(String(p), p, false, p === current);
        }
      });
      button("Next", current + 1, current === totalPages, false);
    }

    render();
  }

  function init() {
    document.querySelectorAll("tbody[data-paginate]").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
