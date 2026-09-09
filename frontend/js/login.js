const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginPanel = document.getElementById('loginPanel');
const signupPanel = document.getElementById('signupPanel');

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabSignup.classList.remove('active');
  loginPanel.hidden = false;
  signupPanel.hidden = true;
});
tabSignup.addEventListener('click', () => {
  tabSignup.classList.add('active');
  tabLogin.classList.remove('active');
  signupPanel.hidden = false;
  loginPanel.hidden = true;
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('loginError');
  clearError(errEl);
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await Api.post('/auth/login', { email, password });
    Api.setToken(data.token);
    Api.setUser(data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError(errEl, err);
  }
});

document.getElementById('signupBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('signupError');
  clearError(errEl);
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const password2 = document.getElementById('signupPassword2').value;
  if (password !== password2) {
    showError(errEl, new Error('Passwords do not match'));
    return;
  }
  try {
    const data = await Api.post('/auth/signup', { email, password });
    Api.setToken(data.token);
    Api.setUser(data.user);
    window.location.href = 'dashboard.html';
  } catch (err) {
    showError(errEl, err);
  }
});

if (Api.getToken()) {
  window.location.href = 'dashboard.html';
}
