// Presentation only. Permissions, amounts and leave decisions remain server-owned.
document.querySelectorAll('[data-password-toggle]').forEach(button => {
  const input = document.getElementById(button.getAttribute('aria-controls'));
  if (!input) return;
  button.hidden = false;
  button.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(show));
  });
});
document.querySelectorAll('.badge').forEach(badge => {
  badge.dataset.state = badge.textContent.trim().toLowerCase().replace(/\s+/g, '_');
});
