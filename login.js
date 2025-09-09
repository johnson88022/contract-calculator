document.addEventListener('DOMContentLoaded', () => {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const msgEl = document.getElementById('loginMsg');

  // 基礎工具：使用 localStorage 儲存使用者與 session
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem('users') || '{}');
    } catch (e) {
      return {};
    }
  }

  function setUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
  }

  function setSession(email) {
    localStorage.setItem('sessionUser', email);
  }

  async function pbkdf2Hash(password, saltBase64, iterations) {
    const enc = new TextEncoder();
    const pwKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = saltBase64 ? Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
    const iter = iterations || 100000;

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: iter,
        hash: 'SHA-256'
      },
      pwKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const raw = await crypto.subtle.exportKey('raw', key);
    const hashBytes = new Uint8Array(raw);
    const hashBase64 = btoa(String.fromCharCode.apply(null, Array.from(hashBytes)));
    const saltB64 = btoa(String.fromCharCode.apply(null, Array.from(salt)));
    return { hashBase64, saltB64, iterations: iter };
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
    if (!localStorage.getItem(`calcHistory:${email}`)) {
      localStorage.setItem(`calcHistory:${email}`, '[]');
    }
    setSession(email);
    
    // 已移除雲端同步功能
    
    window.location.href = 'index.html';
  }

  async function handleLogin() {
    const email = emailEl.value.trim().toLowerCase();
    const pw = passEl.value;
    if (!email || !pw) { msgEl.textContent = '請輸入 Email 與密碼'; return; }
    const users = getUsers();
    if (handleLogin._busy) return;
    handleLogin._busy = true;
    setTimeout(() => { handleLogin._busy = false; }, 600);

    const rec = users[email];
    if (!rec) { msgEl.textContent = '帳號或密碼錯誤'; return; }
    
    if (rec.password) {
      const legacyHash = (() => { let h = 0; for (let i = 0; i < pw.length; i++) { h = (h << 5) - h + pw.charCodeAt(i); h |= 0; } return String(h); })();
      if (legacyHash !== rec.password) { msgEl.textContent = '帳號或密碼錯誤'; return; }
    } else if (rec.hash && rec.salt) {
      try {
        const { hashBase64 } = await pbkdf2Hash(pw, rec.salt, rec.iter || 100000);
        if (hashBase64 !== rec.hash) { msgEl.textContent = '帳號或密碼錯誤'; return; }
      } catch (e) {
        msgEl.textContent = '瀏覽器不支援安全雜湊，請更換瀏覽器';
        return;
      }
    } else {
      msgEl.textContent = '帳號資料缺失，請重新註冊';
      return;
    }
    setSession(email);
    if (!localStorage.getItem(`calcHistory:${email}`)) {
      localStorage.setItem(`calcHistory:${email}`, '[]');
    }
    // 自動匯入每位使用者的歷史資訊（從新增的 JSON 檔案）
    try {
      const res = await fetch(`data/users/${encodeURIComponent(email)}.json`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem(`calcHistory:${email}`, JSON.stringify(data));
        } else if (data && Array.isArray(data.history)) {
          localStorage.setItem(`calcHistory:${email}`, JSON.stringify(data.history));
        }
      }
    } catch (e) {
      // 忽略匯入錯誤，保持本地空陣列或既有資料
      console.warn('自動匯入歷史資訊失敗或不存在 JSON 檔案');
    }
    
    // 已移除雲端同步功能
    
    window.location.href = 'index.html';
  }

  document.getElementById('registerBtn').addEventListener('click', handleRegister);
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
});