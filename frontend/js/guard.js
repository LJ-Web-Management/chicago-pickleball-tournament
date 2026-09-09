function requireLogin() {
  if (!Api.getToken()) {
    window.location.href = 'index.html';
  }
}

function requireAdmin() {
  if (!Api.getAdminToken()) {
    window.location.href = 'admin.html';
  }
}

function logout() {
  Api.clearAll();
  window.location.href = 'index.html';
}

function divisionLabel(key) {
  return { men: "Men's", women: "Women's", kids: 'Kids' }[key] || key;
}

function showError(el, err) {
  el.textContent = err.message || String(err);
  el.hidden = false;
}

function clearError(el) {
  el.hidden = true;
  el.textContent = '';
}
