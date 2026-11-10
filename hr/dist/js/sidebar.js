// Shared navigation behavior for every XianFire page.
export function initializeSidebar() {
  const toggles = document.querySelectorAll('[data-sidebar-toggle]');
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const closeSidebar = () => {
    document.body.classList.remove('sidebar-open');
    toggles.forEach(button => button.setAttribute('aria-expanded', 'false'));
  };

  toggles.forEach(button => button.addEventListener('click', () => {
    const open = document.body.classList.toggle('sidebar-open');
    button.setAttribute('aria-expanded', String(open));
    if (open) sidebar.querySelector('a')?.focus();
  }));
  document.querySelectorAll('[data-sidebar-close]').forEach(button => button.addEventListener('click', closeSidebar));
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', closeSidebar));
  document.onkeydown = event => {
    if (event.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
      closeSidebar();
      toggles[0]?.focus();
    }
  };
}

initializeSidebar();
