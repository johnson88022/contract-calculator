document.addEventListener('DOMContentLoaded', () => {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const msgEl = document.getElementById('loginMsg');

  function hash(s) {
    // 簡單雜湊（非安全用），用於 demo
    let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return String(h);
  }

  function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '{}');
  }
  function setUsers(u) {
    localStorage.setItem('users', JSON.stringify(u));
  }

  function setSession(email) {
    localStorage.setItem('sessionUser', email);
  }

  function handleRegister() {
    const email = emailEl.value.trim().toLowerCase();
    const pw = passEl.value;
    if (!email || !pw) { msgEl.textContent = '請輸入 Email 與密碼'; return; }
    const users = getUsers();
    if (users[email]) { msgEl.textContent = '帳號已存在，請直接登入'; return; }
    users[email] = { password: hash(pw) };
    setUsers(users);
    // 為此帳號建立獨立的歷史命名空間
    if (!localStorage.getItem(`calcHistory:${email}`)) {
      localStorage.setItem(`calcHistory:${email}`, '[]');
    }
    setSession(email);
    window.location.href = 'index.html';
  }

  function handleLogin() {
    const email = emailEl.value.trim().toLowerCase();
    const pw = passEl.value;
    if (!email || !pw) { msgEl.textContent = '請輸入 Email 與密碼'; return; }
    const users = getUsers();
    // 防抖處理避免重複點擊導致「失敗/成功」交替
    if (handleLogin._busy) return;
    handleLogin._busy = true;
    setTimeout(() => { handleLogin._busy = false; }, 600);

    if (!users[email] || users[email].password !== hash(pw)) { msgEl.textContent = '帳號或密碼錯誤'; return; }
    setSession(email);
    // 確保此帳號歷史命名空間存在
    if (!localStorage.getItem(`calcHistory:${email}`)) {
      localStorage.setItem(`calcHistory:${email}`, '[]');
    }
    window.location.href = 'index.html';
  }

  document.getElementById('registerBtn').addEventListener('click', handleRegister);
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
});


