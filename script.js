document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM已加載完成");
  const currentUser = localStorage.getItem('sessionUser');
  if (!currentUser) {
    if (location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname === '') {
      location.href = 'login.html';
      return;
    }
  }
  const userInfoEl = document.getElementById('userInfo');
  if (userInfoEl) {
    const email = localStorage.getItem('sessionUser');
    userInfoEl.textContent = email ? `已登入：${email}` : '未登入';
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      localStorage.removeItem('sessionUser');
      location.href = 'login.html';
    });
  }

  let presetPercents = { tp1: 0, tp2: 0, tp3: 0 };
  const presetEl = document.getElementById("tpPreset");
  if (presetEl) {
    const updateView = function() {
      const view = document.getElementById("tpPctView");
      if (view) {
        view.textContent = `目前比例：${presetPercents.tp1}/${presetPercents.tp2}/${presetPercents.tp3}`;
      }
    };
    presetEl.addEventListener("change", function() {
      const val = presetEl.value;
      if (!val) {
        presetPercents = { tp1: 0, tp2: 0, tp3: 0 };
        updateView();
        return;
      }
      const [p1, p2, p3] = val.split("-").map(v => parseFloat(v));
      presetPercents = {
        tp1: isNaN(p1) ? 0 : p1,
        tp2: isNaN(p2) ? 0 : p2,
        tp3: isNaN(p3) ? 0 : p3
      };
      updateView();
    });
    updateView();
  }

  const calculateBtn = document.getElementById("calculate");
  const resultDiv = document.getElementById("result");
  if (calculateBtn && resultDiv) {
    calculateBtn.addEventListener("click", calculatePosition);
  }

  (function initCloudConfig() {
    const params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const hashToken = params.get('token');
    if (hashToken) {
      localStorage.setItem('cloudToken', hashToken);
    }
    if (!localStorage.getItem('cloudToken')) {
      setTimeout(() => {
        const t = prompt('請貼上 GitHub Token（只保存在本機以啟用雲端同步）');
        if (t) localStorage.setItem('cloudToken', t.trim());
      }, 300);
    }
  })();

  const APP_CLOUD = {
    owner: 'johnson88022',
    repo: 'contract-db',
    basePath: 'db/users',
    get token() { return localStorage.getItem('cloudToken') || ''; },
    intervalMs: 10000
  };

  function getCloudPathForUser() {
    const email = localStorage.getItem('sessionUser') || 'guest';
    return `${APP_CLOUD.basePath}/${encodeURIComponent(email)}.json`;
  }

  async function githubGetFile(owner, repo, path, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json'
      },
      cache: 'no-store'
    });
    if (resp.status === 404) return { exists: false };
    if (!resp.ok) throw new Error('GitHub GET failed');
    const data = await resp.json();
    const content = data.content ? atob(data.content.replace(/\n/g, '')) : '';
    return { exists: true, sha: data.sha, content };
  }

  async function githubPutFile(owner, repo, path, token, contentString, sha, message) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const body = { message: message || `update ${path}`, content: btoa(unescape(encodeURIComponent(contentString))) };
    if (sha) body.sha = sha;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error('GitHub PUT failed');
    return resp.json();
  }

  async function syncToCloud() {
    const token = APP_CLOUD.token;
    if (!token) return false;
    const path = getCloudPathForUser();
    const history = getHistory();
    try {
      const res = await githubGetFile(APP_CLOUD.owner, APP_CLOUD.repo, path, token).catch(() => ({ exists:false }));
      const sha = res && res.exists ? res.sha : undefined;
      await githubPutFile(APP_CLOUD.owner, APP_CLOUD.repo, path, token, JSON.stringify(history, null, 2), sha, 'sync history');
      return true;
    } catch (e) {
      console.error('syncToCloud failed', e);
      return false;
    }
  }

  async function syncFromCloud() {
    const token = APP_CLOUD.token;
    if (!token) return false;
    const path = getCloudPathForUser();
    try {
      const res = await githubGetFile(APP_CLOUD.owner, APP_CLOUD.repo, path, token);
      if (!res.exists) return false;
      const remote = JSON.parse(res.content || '[]');
      const local = getHistory();
      const map = new Map();
      local.forEach(it => { if (it && it.time) map.set(it.time, it); });
      remote.forEach(it => {
        if (!it || !it.time) return;
        const a = map.get(it.time);
        if (!a) map.set(it.time, it);
        else if ((it.updatedAt||0) > (a.updatedAt||0)) map.set(it.time, it);
      });
      const merged = Array.from(map.values()).sort((a,b)=> new Date(b.time)-new Date(a.time)).slice(0,50);
      setHistory(merged);
      loadHistory();
      return true;
    } catch (e) {
      console.error('syncFromCloud failed', e);
      return false;
    }
  }

  function calculatePosition() {
    try {
      const L = parseFloat(document.getElementById("leverage").value) || 0;
      const dir = document.getElementById("direction").value;
      const E = parseFloat(document.getElementById("entry").value) || 0;
      const S = parseFloat(document.getElementById("stop").value) || 0;
      const M = parseFloat(document.getElementById("maxLoss").value) || 0;
      const symbol = document.getElementById("symbol").value.trim() || "未輸入";
      if (E <= 0 || S <= 0 || M <= 0) {
        resultDiv.innerHTML = "⚠ 請輸入有效的數值（必須大於0）";
        return;
      }
      if (E === S) {
        resultDiv.innerHTML = "⚠ 進場價和止損價不能相同";
        return;
      }
      let riskPerContract = dir === "long" ? (E - S) : (S - E);
      if (riskPerContract <= 0) {
        resultDiv.innerHTML = "⚠ 止損方向錯誤，請確認數值";
        return;
      }
      const stopPercent = ((Math.abs(E - S) / E) * 100).toFixed(2);
      const positionValue = (M / riskPerContract) * E;
      const margin = positionValue / L;
      const summaryLine = `${symbol}｜${dir === 'long' ? '做多' : '做空'} ${L}x｜倉位 ${positionValue.toFixed(2)} U｜保證金 ${margin.toFixed(2)} U｜止損 ${stopPercent}%`;
      resultDiv.innerHTML = `<div style="padding: 10px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
        <div style="font-weight: bold; margin-bottom: 8px;">📊 計算結果</div>
        <div>${summaryLine}</div>
      </div>`;
      const tp1 = parseFloat(document.getElementById('tp1Price').value) || null;
      const tp2 = parseFloat(document.getElementById('tp2Price').value) || null;
      const tp3 = parseFloat(document.getElementById('tp3Price').value) || null;
      const record = {
        leverage: L, direction: dir, entry: E, stop: S, maxLoss: M,
        stopPercent, positionValue: positionValue.toFixed(2), margin: margin.toFixed(2),
        symbol, time: new Date().toLocaleString(), updatedAt: Date.now(), device: getDeviceInfo(),
        tp: { presetPercents: { ...presetPercents }, prices: { tp1, tp2, tp3 } }
      };
      saveResult(record);
      loadHistory();
      syncToCloud().catch(()=>{});
    } catch (err) {
      console.error("計算錯誤:", err);
      resultDiv.innerHTML = "⚠ 計算時發生錯誤，請檢查輸入或重新整理頁面";
    }
  }

  function getDeviceInfo() {
    return { userAgent: navigator.userAgent, platform: navigator.platform, screen: `${screen.width}x${screen.height}`, timestamp: new Date().toISOString() };
  }

  function getHistory() {
    const email = localStorage.getItem('sessionUser') || 'guest';
    const historyStr = localStorage.getItem(`calcHistory:${email}`) || "[]";
    try { return JSON.parse(historyStr); } catch { return []; }
  }

  function setHistory(list) {
    const email = localStorage.getItem('sessionUser') || 'guest';
    localStorage.setItem(`calcHistory:${email}`, JSON.stringify(list));
  }

  function saveResult(record) {
    let history = getHistory();
    record.updatedAt = Date.now();
    history.unshift(record);
    if (history.length > 50) history = history.slice(0, 50);
    setHistory(history);
  }

  function loadHistory() {
    const historyDiv = document.getElementById("history");
    if (!historyDiv) return;
    const history = getHistory();
    if (history.length === 0) {
      historyDiv.innerHTML = "<div style='padding: 10px; text-align: center; color: #666;'>尚無紀錄</div>";
      return;
    }
    let html = '';
    history.forEach((record, index) => {
      const rText =
        record.tradeResult === 'R' && record.tradeR !== undefined && record.tradeR !== '' && !isNaN(parseFloat(record.tradeR))
          ? `R ${record.tradeR}`
          : (record.tradeResult || '');
      html += `
      <div class="history-item" style="border:1px solid #ddd;border-radius:6px;padding:10px;margin-bottom:8px;">
        <details>
          <summary style="cursor:pointer;">
            <div>${record.symbol}｜${record.direction === 'long' ? '做多' : '做空'} ${record.leverage}x｜倉位 ${record.positionValue} U｜保證金 ${record.margin} U｜止損 ${record.stopPercent}%</div>
            <div>交易結果：${rText}</div>
          </summary>
        </details>
        <div class="record-actions" style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">
          <button class="pill-btn action-edit" data-action="editRow" data-i="${index}">編輯</button>
          <button class="pill-btn action-save" data-action="saveRow" data-i="${index}" style="display:none;">保存</button>
          <button class="pill-btn action-cancel" data-action="cancelEdit" data-i="${index}" style="display:none;">取消</button>
          <button class="pill-btn" onclick="deleteRecord(${index})">刪除</button>
        </div>
      </div>`;
    });
    historyDiv.innerHTML = html;
  }

  window.deleteRecord = function(index) {
    if (confirm("確定要刪除此紀錄嗎？")) {
      let history = getHistory();
      history.splice(index, 1);
      setHistory(history);
      loadHistory();
    }
  };

  loadHistory();
});