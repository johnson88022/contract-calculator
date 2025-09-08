document.addEventListener('DOMContentLoaded', () => {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const msgEl = document.getElementById('loginMsg');

  // 以 WebCrypto 儲存「鹽化 + PBKDF2」後的密碼雜湊（不存明碼）
  async function pbkdf2Hash(password, saltBase64, iterations = 100000) {
    const enc = new TextEncoder();
    const salt = saltBase64 ? Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt, iterations }, keyMaterial, 256);
    const hashBytes = new Uint8Array(bits);
    const hashBase64 = btoa(String.fromCharCode(...hashBytes));
    const saltB64 = saltBase64 || btoa(String.fromCharCode(...salt));
    return { hashBase64, saltB64, iterations };
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

  async function handleRegister() {
    const email = emailEl.value.trim().toLowerCase();
    const pw = passEl.value;
    if (!email || !pw) { msgEl.textContent = '請輸入 Email 與密碼'; return; }
    const users = getUsers();
    if (users[email]) { msgEl.textContent = '帳號已存在，請直接登入'; return; }
    try {
      const { hashBase64, saltB64, iterations } = await pbkdf2Hash(pw);
      users[email] = { hash: hashBase64, salt: saltB64, iter: iterations, alg: 'PBKDF2-SHA256' };
    } catch (e) {
      msgEl.textContent = '瀏覽器不支援安全雜湊，請更換瀏覽器';
      return;
    }
    setUsers(users);
    // 為此帳號建立獨立的歷史命名空間
    if (!localStorage.getItem(`calcHistory:${email}`)) {
      localStorage.setItem(`calcHistory:${email}`, '[]');
    }
    setSession(email);
    window.location.href = 'index.html';
  }

  async function handleLogin() {
    const email = emailEl.value.trim().toLowerCase();
    const pw = passEl.value;
    if (!email || !pw) { msgEl.textContent = '請輸入 Email 與密碼'; return; }
    const users = getUsers();
    // 防抖處理避免重複點擊導致「失敗/成功」交替
    if (handleLogin._busy) return;
    handleLogin._busy = true;
    setTimeout(() => { handleLogin._busy = false; }, 600);

    if (!users[email]) { msgEl.textContent = '帳號或密碼錯誤'; return; }
    try {
      const rec = users[email];
      const { hashBase64 } = await pbkdf2Hash(pw, rec.salt, rec.iter || 100000);
      if (hashBase64 !== rec.hash) { msgEl.textContent = '帳號或密碼錯誤'; return; }
    } catch (e) {
      msgEl.textContent = '瀏覽器不支援安全雜湊，請更換瀏覽器';
      return;
    }
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


