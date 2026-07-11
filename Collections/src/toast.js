(() => {
let root = null;

function ensureRoot() {
  if (!root) {
    root = document.createElement('div');
    root.className = 'toast-root';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
}

function toast(message, duration = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  ensureRoot().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // fallback
  }, duration);
}

window.CollectionsToast = {
  toast,
};
})();
