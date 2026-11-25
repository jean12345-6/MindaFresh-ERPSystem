// Responsive navigation; the drawer cannot leave focus in offscreen links.
export function initializeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const toggles = Array.from(document.querySelectorAll('[data-sidebar-toggle]'));
  const mobile = window.matchMedia('(max-width: 760px)');
  const focusable = () => Array.from(sidebar.querySelectorAll('a[href], button:not([disabled])')).filter(el => el.getClientRects().length);
  const setOpen = (open, restoreFocus = false) => {
    document.body.classList.toggle('sidebar-open', open);
    sidebar.inert = mobile.matches && !open;
    toggles.forEach(button => button.setAttribute('aria-expanded', String(open)));
    if (open) focusable()[0]?.focus();
    else if (restoreFocus) toggles[0]?.focus();
  };
  toggles.forEach(button => button.addEventListener('click', () => setOpen(!document.body.classList.contains('sidebar-open'))));
  document.querySelectorAll('[data-sidebar-close]').forEach(button => button.addEventListener('click', () => setOpen(false, true)));
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (!mobile.matches || !document.body.classList.contains('sidebar-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); }
    if (event.key === 'Tab') {
      const links = focusable();
      if (!links.length) return;
      const first = links[0], last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  mobile.addEventListener('change', () => setOpen(false));
  setOpen(false);
}
initializeSidebar();
