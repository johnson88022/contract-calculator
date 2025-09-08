document.addEventListener('DOMContentLoaded', () => {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  const msgEl = document.getElementById('loginMsg');

  // ... 保持原有的 pbkdf2Hash、getUsers、setUsers、setSession 函數不變 ...

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
    
    // 登入後立即同步
    setTimeout(() => {
      if (typeof syncFromCloud === 'function') {
        syncFromCloud().catch(console.error);
      }
    }, 500);
    
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
    
    // 登入後立即同步
    setTimeout(() => {
      if (typeof syncFromCloud === 'function') {
        syncFromCloud().catch(console.error);
      }
    }, 500);
    
    window.location.href = 'index.html';
  }

  document.getElementById('registerBtn').addEventListener('click', handleRegister);
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
});