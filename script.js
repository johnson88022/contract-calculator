// 完整的 script.js 包含雲端同步
document.addEventListener("DOMContentLoaded", function() {
    console.log("DOM已加載完成");
    
    // 檢查登入狀態
    const currentUser = localStorage.getItem('sessionUser');
    if (!currentUser) {
        if (location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname === '') {
            location.href = 'login.html';
            return;
        }
    }
    
    // 顯示用戶信息
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        const email = localStorage.getItem('sessionUser');
        userInfoEl.textContent = email ? `已登入：${email}` : '未登入';
    }
    
    // 登出功能
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('sessionUser');
            location.href = 'login.html';
        });
    }
    
    // 當前選中的比例
    let presetPercents = { tp1: 0, tp2: 0, tp3: 0 };
    
    // 止盈方案選單
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
            const [p1, p2, p3] = val.split("-").map(function(v) { return parseFloat(v); });
            presetPercents = {
                tp1: isNaN(p1) ? 0 : p1,
                tp2: isNaN(p2) ? 0 : p2,
                tp3: isNaN(p3) ? 0 : p3
            };
            updateView();
        });
        
        updateView();
    }
    
    // 計算按鈕事件綁定
    const calculateBtn = document.getElementById("calculate");
    const resultDiv = document.getElementById("result");
    
    if (calculateBtn && resultDiv) {
        calculateBtn.addEventListener("click", function() {
            calculatePosition();
        });
    }
    
    // 雲端同步（GitHub repo: contract-db/db/users/<email>.json）
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
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
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
        const body = { message: message || `update ${path}`,
                       content: btoa(unescape(encodeURIComponent(contentString))) };
        if (sha) body.sha = sha;
        const resp = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
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
                if (!a) { map.set(it.time, it); return; }
                const ua = a.updatedAt || 0;
                const ub = it.updatedAt || 0;
                if (ub > ua) map.set(it.time, it);
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
    
    // 計算倉位函數
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
            
            const resultText = `
                <div style="padding: 10px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
                    <div style="font-weight: bold; margin-bottom: 8px;">📊 計算結果</div>
                    <div>${summaryLine}</div>
                    <div style="margin-top: 8px; font-size: 14px; color: #666;">
                        <div>方向: ${dir === 'long' ? '做多 📈' : '做空 📉'}</div>
                        <div>進場價: ${E} | 止損價: ${S}</div>
                        <div>最大虧損: ${M} U</div>
                        <div>倉位價值: ${positionValue.toFixed(2)} U</div>
                        <div>所需保證金: ${margin.toFixed(2)} U</div>
                    </div>
                </div>
            `;
            
            resultDiv.innerHTML = resultText;
            
            // 取得 TP 價位（可選）
            const tp1 = parseFloat(document.getElementById('tp1Price').value) || null;
            const tp2 = parseFloat(document.getElementById('tp2Price').value) || null;
            const tp3 = parseFloat(document.getElementById('tp3Price').value) || null;

            // 保存到歷史記錄
            const record = {
                leverage: L,
                direction: dir,
                entry: E,
                stop: S,
                maxLoss: M,
                stopPercent: stopPercent,
                positionValue: positionValue.toFixed(2),
                margin: margin.toFixed(2),
                symbol: symbol,
                time: new Date().toLocaleString(),
                updatedAt: Date.now(),
                device: getDeviceInfo(),
                tp: {
                    presetPercents: { ...presetPercents },
                    prices: { tp1, tp2, tp3 }
                }
            };
            
            saveResult(record);
            // 計算後立即刷新歷史
            loadHistory();
            // 同步到雲端
            syncToCloud().catch(()=>{});
            
        } catch (err) {
            console.error("計算錯誤:", err);
            resultDiv.innerHTML = "⚠ 計算時發生錯誤，請檢查輸入或重新整理頁面";
        }
    }
    
    // 獲取設備信息
    function getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            screen: `${screen.width}x${screen.height}`,
            timestamp: new Date().toISOString()
        };
    }

    // 讓內嵌輸入與選單寬度根據內容自動調整，不預留空白
    function autosizeInlineFields(scope) {
        const root = scope || document;
        const measure = document.createElement('span');
        measure.style.visibility = 'hidden';
        measure.style.position = 'absolute';
        measure.style.whiteSpace = 'pre';
        measure.style.fontSize = '14px';
        measure.style.fontFamily = getComputedStyle(document.body).fontFamily;
        document.body.appendChild(measure);

        function textWidth(text) {
            measure.textContent = text || '';
            return measure.getBoundingClientRect().width;
        }

        root.querySelectorAll('input.inline-edit').forEach(function(inp){
            const initial = (inp.value || inp.placeholder || '').toString();
            const minWidthPx = Math.ceil(textWidth(initial)) + 10;
            function resize() {
                const val = (inp.value || inp.placeholder || '').toString();
                const w = Math.ceil(textWidth(val)) + 10; // 內距微調
                inp.style.width = Math.max(w, minWidthPx) + 'px';
            }
            resize();
            inp.removeEventListener('input', resize);
            inp.addEventListener('input', resize);
        });

        root.querySelectorAll('select.inline-select').forEach(function(sel){
            function resizeSel() {
                const selectedText = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
                const w = Math.ceil(textWidth(selectedText)) + 24; // 包含下拉箭頭空間
                sel.style.width = w + 'px';
            }
            resizeSel();
            sel.removeEventListener('change', resizeSel);
            sel.addEventListener('change', resizeSel);
        });

        document.body.removeChild(measure);
    }
    
    // 歷史記錄功能
    function getHistory() {
        const email = localStorage.getItem('sessionUser') || 'guest';
        const historyStr = localStorage.getItem(`calcHistory:${email}`) || "[]";
        try {
            return JSON.parse(historyStr);
        } catch (e) {
            return [];
        }
    }
    
    function setHistory(list) {
        const email = localStorage.getItem('sessionUser') || 'guest';
        localStorage.setItem(`calcHistory:${email}`, JSON.stringify(list));
    }
    
    function saveResult(record) {
        let history = getHistory();
        record.updatedAt = Date.now();
        history.unshift(record);
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
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
        history.forEach(function(record, index) {
            const p = record.tp && record.tp.presetPercents ? record.tp.presetPercents : { tp1: 0, tp2: 0, tp3: 0 };
            const prices = record.tp && record.tp.prices ? record.tp.prices : {};
            const totalPositionValue = parseFloat(record.positionValue || '0') || 0;
            const entry = parseFloat(record.entry || '0') || 0;
            const dirLong = record.direction === 'long';
            function calcProfit(exitPrice, percent) {
                if (!exitPrice || !entry || !percent) return null;
                const portion = totalPositionValue * (percent / 100);
                const pnlPerUnit = dirLong ? (exitPrice - entry) : (entry - exitPrice);
                const expected = (portion / entry) * pnlPerUnit;
                return { portionValue: portion.toFixed(2), profit: expected.toFixed(2) };
            }
            const tp1res = calcProfit(prices.tp1, p.tp1);
            const tp2res = calcProfit(prices.tp2, p.tp2);
            const tp3res = calcProfit(prices.tp3, p.tp3);

            const rText = (record.tradeResult === 'R' && record.tradeR !== undefined && record.tradeR !== null && record.tradeR !== '' && !isNaN(parseFloat(record.tradeR))) ? ('R ' + parseFloat(record.tradeR)) : (record.tradeResult || '');
            const summaryView = `
                        <div style="margin-bottom: 6px;"><b>${record.time}</b></div>
                        <div class="row-view">幣種 ${record.symbol}｜槓桿 ${record.leverage}｜入場價位 ${record.entry} ｜方向 ${record.direction === 'long' ? '多' : '空'}｜倉位價值 ${record.positionValue} U</div>
                        <div class="row-view">最大虧損: ${record.maxLoss} U ｜保證金 ${record.margin} U｜止損 ${record.stopPercent} % </div>
                        <div class="row-view">交易結果： ${rText}</div>`;
            const summaryEdit = `
                        <div class="row-edit">幣種 <input class="inline-edit" value="${record.symbol}" data-k="symbol" data-i="${index}">｜槓桿 <input class="inline-edit" type="number" value="${record.leverage}" data-k="leverage" data-i="${index}">｜入場價位 <input class="inline-edit" type="number" value="${record.entry}" data-k="entry" data-i="${index}"> ｜方向 <select class="inline-select" data-k="direction" data-i="${index}"><option value="long" ${record.direction==='long'?'selected':''}>多</option><option value="short" ${record.direction==='short'?'selected':''}>空</option></select>｜倉位價值 <input class="inline-edit" type="number" step="0.01" value="${record.positionValue}" data-k="positionValue" data-i="${index}"> U</div>
                        <div class="row-edit">最大虧損: <input class="inline-edit" type="number" value="${record.maxLoss}" data-k="maxLoss" data-i="${index}"> U ｜保證金 <input class="inline-edit" type="number" step="0.01" value="${record.margin}" data-k="margin" data-i="${index}"> U｜止損 <input class="inline-edit" type="number" step="0.01" value="${record.stopPercent}" data-k="stopPercent" data-i="${index}"> %</div>
                        <div class="row-edit">交易結果： <select class="inline-select" data-action="resultSelect" data-i="${index}"><option value="" ${record.tradeResult?'' : 'selected'}>未選擇</option><option ${record.tradeResult==='TP1'?'selected':''} value="TP1">TP1</option><option ${record.tradeResult==='TP2'?'selected':''} value="TP2">TP2</option><option ${record.tradeResult==='TP3'?'selected':''} value="TP3">TP3</option><option ${record.tradeResult==='SL'?'selected':''} value="SL">SL</option><option ${record.tradeResult==='R'?'selected':''} value="R">R</option></select><input class="inline-edit" type="number" step="0.01" placeholder="R 值" value="${record.tradeR || ''}" data-k="tradeR" data-i="${index}" style="margin-left:6px;"></div>`;

            html += `
                <details class="history-item">
                    <summary style="cursor:pointer;">
${summaryView}
${summaryEdit}
                        <span class="result-hint">點我展開 TP 明細</span>
                    </summary>
                    <div class="result-details">
                        <table class="tp-table">
                            <thead>
                                <tr><th>TP</th><th>比例(%)</th><th>價位</th><th>平倉倉位價值(U)</th><th>預期盈利(U)</th></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>TP1</td>
                                    <td>${p.tp1 ?? '--'}</td>
                                    <td>${prices.tp1 ?? '--'}</td>
                                    <td>${tp1res ? tp1res.portionValue : '--'}</td>
                                    <td>${tp1res ? tp1res.profit : '--'}</td>
                                </tr>
                                <tr>
                                    <td>TP2</td>
                                    <td>${p.tp2 ?? '--'}</td>
                                    <td>${prices.tp2 ?? '--'}</td>
                                    <td>${tp2res ? tp2res.portionValue : '--'}</td>
                                    <td>${tp2res ? tp2res.profit : '--'}</td>
                                </tr>
                                <tr>
                                    <td>TP3</td>
                                    <td>${p.tp3 ?? '--'}</td>
                                    <td>${prices.tp3 ?? '--'}</td>
                                    <td>${tp3res ? tp3res.portionValue : '--'}</td>
                                    <td>${tp3res ? tp3res.profit : '--'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="record-actions" style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">
                        <button class="pill-btn action-edit" data-action="editRow" data-i="${index}">編輯</button>
                        <button class="pill-btn action-save" data-action="saveRow" data-i="${index}" style="display:none;">保存</button>
                        <button class="pill-btn action-cancel" data-action="cancelEdit" data-i="${index}" style="display:none;">取消</button>
                        <button class="pill-btn" onclick="deleteRecord(${index})">刪除</button>
                    </div>
                </details>
            `;
        });

        historyDiv.innerHTML = html;
        // 若指定保持展開與編輯模式，重新套用
        if (window._keepOpenIndex != null) {
            const all = historyDiv.querySelectorAll('.history-item');
            const d = all[window._keepOpenIndex];
            if (d && d.tagName && d.tagName.toLowerCase() === 'details') {
                d.open = true;
                if (window._keepEditMode) {
                    const summary = d.querySelector('summary');
                    if (summary) {
                        summary.querySelectorAll('.row-view').forEach(function(el){ el.style.display = 'none'; });
                        summary.querySelectorAll('.row-edit').forEach(function(el){ el.style.display = 'block'; });
                    }
                }
            }
            window._keepOpenIndex = null;
            window._keepEditMode = null;
        }
        // 綁定保存/編輯/取消/交易結果事件（在列表渲染後）
        // 讓內嵌輸入/選單寬度自動貼合內容
        autosizeInlineFields(historyDiv);
        historyDiv.querySelectorAll('button[data-action="saveRow"]').forEach(function(btn){
            btn.addEventListener('click', function(e){
                const i = parseInt(e.currentTarget.getAttribute('data-i'));
                let history = getHistory();
                const row = history[i];
                if (!row) return;
                const details = e.currentTarget.closest('details');
                const container = details; // operate within details
                const inputs = container.querySelectorAll('input[data-k]');
                inputs.forEach(function(inp){
                    const k = inp.getAttribute('data-k');
                    let v = inp.value;
                    if (k !== 'symbol') v = parseFloat(v);
                    row[k] = v;
                });
                // 讀取 select 類型欄位（例如方向）
                const selects = container.querySelectorAll('select[data-k]');
                selects.forEach(function(sel){
                    const k = sel.getAttribute('data-k');
                    row[k] = sel.value;
                });
                // 同步保存交易結果選擇
                const resultSel = container.querySelector(`select[data-action="resultSelect"][data-i="${i}"]`);
                if (resultSel) {
                    row.tradeResult = resultSel.value;
                }
                // 依最新 entry/leverage/stopPercent 等重新計算衍生欄位
                const L = parseFloat(row.leverage)||0;
                const E = parseFloat(row.entry)||0;
                const M = parseFloat(row.maxLoss)||0;
                const S = parseFloat(row.stop)||0;
                const stopPercent = ((Math.abs(E - S) / (E||1)) * 100).toFixed(2);
                row.stopPercent = stopPercent;
                // 用舊公式更新 positionValue 與 margin（維持一致性）
                const riskPerContract = row.direction === 'long' ? (E - S) : (S - E);
                if (E>0 && riskPerContract>0 && M>0) {
                    const positionValue = (M / riskPerContract) * E;
                    const margin = positionValue / (L||1);
                    row.positionValue = positionValue.toFixed(2);
                    row.margin = margin.toFixed(2);
                }
                row.updatedAt = Date.now();
                setHistory(history);
                // 記住目前展開索引，保存後回到非編輯狀態
                window._keepOpenIndex = i;
                window._keepEditMode = false;
                loadHistory();
                syncToCloud().catch(()=>{});
                // 切換按鈕狀態
                if (details) {
                    const summary = details.querySelector('summary');
                    if (summary) {
                        summary.querySelectorAll('.row-edit').forEach(function(el){ el.style.display='none'; });
                        summary.querySelectorAll('.row-view').forEach(function(el){ el.style.display='block'; });
                    }
                    const editBtn = details.querySelector('.action-edit');
                    const saveBtn = details.querySelector('.action-save');
                    const cancelBtn = details.querySelector('.action-cancel');
                    if (editBtn && saveBtn && cancelBtn) {
                        editBtn.style.display = '';
                        saveBtn.style.display = 'none';
                        cancelBtn.style.display = 'none';
                    }
                }
            });
        });
        historyDiv.querySelectorAll('button[data-action="editRow"]').forEach(function(btn){
            btn.addEventListener('click', function(e){
                const details = e.currentTarget.closest('details');
                if (!details) return;
                const summary = details.querySelector('summary');
                if (!summary) return;
                summary.querySelectorAll('.row-view').forEach(function(el){ el.style.display='none'; });
                summary.querySelectorAll('.row-edit').forEach(function(el){ el.style.display='block'; });
                autosizeInlineFields(summary);
                const editBtn = details.querySelector('.action-edit');
                const saveBtn = details.querySelector('.action-save');
                const cancelBtn = details.querySelector('.action-cancel');
                if (editBtn && saveBtn && cancelBtn) {
                    editBtn.style.display = 'none';
                    saveBtn.style.display = '';
                    cancelBtn.style.display = '';
                }
            });
        });
        historyDiv.querySelectorAll('button[data-action="cancelEdit"]').forEach(function(btn){
            btn.addEventListener('click', function(e){
                const details = e.currentTarget.closest('details');
                const summary = details ? details.querySelector('summary') : null;
                if (!summary) return;
                summary.querySelectorAll('.row-edit').forEach(function(el){ el.style.display='none'; });
                summary.querySelectorAll('.row-view').forEach(function(el){ el.style.display='block'; });
                const editBtn = details.querySelector('.action-edit');
                const saveBtn = details.querySelector('.action-save');
                const cancelBtn = details.querySelector('.action-cancel');
                if (editBtn && saveBtn && cancelBtn) {
                    editBtn.style.display = '';
                    saveBtn.style.display = 'none';
                    cancelBtn.style.display = 'none';
                }
            });
        });
        historyDiv.querySelectorAll('select[data-action="resultSelect"]').forEach(function(sel){
            sel.addEventListener('change', function(e){
                const i = parseInt(e.currentTarget.getAttribute('data-i'));
                let history = getHistory();
                const row = history[i];
                if (!row) return;
                row.tradeResult = e.currentTarget.value;
                row.updatedAt = Date.now();
                setHistory(history);
                syncToCloud().catch(()=>{});
            });
        });
    }
    
    // 全局函數
    window.deleteRecord = function(index) {
        if (confirm("確定要刪除此紀錄嗎？")) {
            let history = getHistory();
            history.splice(index, 1);
            setHistory(history);
            loadHistory();
        }
    };
    
    // 清除歷史記錄
    const clearBtn = document.getElementById("clearHistory");
    if (clearBtn) {
        clearBtn.addEventListener("click", function() {
            if (confirm("確定要清除全部紀錄嗎？")) {
                setHistory([]);
                loadHistory();
            }
        });
    }
    
    // 匯出/匯入功能已移除
    
    // 初始化（移除雲端同步輪詢）
    loadHistory();
});