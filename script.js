// ======================
// 全域變數
// ======================
const APP_CLOUD = {
    repo: "xyvipac/contract-db",
    branch: "main",
    basePath: "db/users",
    token: localStorage.getItem("cloudToken"),
    intervalMs: 10000
};
let sessionUser = null;
let history = [];

// ======================
// 初始化
// ======================
document.addEventListener('DOMContentLoaded', () => {
    sessionUser = JSON.parse(localStorage.getItem('sessionUser'));
    if (!sessionUser) {
        window.location.href = 'login.html';
        return;
    }

    // 顯示使用者 email
    const userInfo = document.getElementById('userInfo');
    if (userInfo) userInfo.textContent = sessionUser.email;

    // 綁定登出
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('sessionUser');
            window.location.href = 'login.html';
        });
    }

    // 綁定止盈方案選擇
    const tpPreset = document.getElementById('tpPreset');
    if (tpPreset) {
        tpPreset.addEventListener('change', () => {
            document.getElementById('tpValue').value = tpPreset.value;
        });
    }

    // 綁定計算按鈕
    const calcBtn = document.getElementById('calcBtn');
    if (calcBtn) {
        calcBtn.addEventListener('click', calculate);
    }

    // 載入歷史紀錄
    loadHistory();
    renderHistory();

    // 先拉一次雲端紀錄
    if (APP_CLOUD.token) {
        syncFromCloud().then(() => {
            renderHistory();
        });
    }

    // 啟用定時同步
    if (APP_CLOUD.token) {
        setInterval(() => {
            syncFromCloud().catch(()=>{});
            syncToCloud().catch(()=>{});
        }, APP_CLOUD.intervalMs);
    }
});

// ======================
// 計算邏輯
// ======================
function calculate() {
    const entry = parseFloat(document.getElementById('entry').value);
    const stoploss = parseFloat(document.getElementById('stoploss').value);
    const loss = parseFloat(document.getElementById('loss').value);
    const leverage = parseFloat(document.getElementById('leverage').value);
    const direction = document.getElementById('direction').value;
    const tp = document.getElementById('tpValue').value;

    if (isNaN(entry) || isNaN(stoploss) || isNaN(loss) || isNaN(leverage)) {
        alert('請完整輸入所有數值');
        return;
    }

    const stopDiff = direction === '做多' ? entry - stoploss : stoploss - entry;
    const stopPercent = stopDiff / entry;
    const positionValue = loss / stopPercent;
    const margin = positionValue / leverage;

    document.getElementById('calcResult').innerHTML = `
        <div class="bg-white shadow rounded-lg p-4 mb-2">
            <p>止損幅度: ${(stopPercent * 100).toFixed(2)}%</p>
            <p>倉位價值: ${positionValue.toFixed(2)}</p>
            <p>所需保證金: ${margin.toFixed(2)}</p>
        </div>
    `;

    // 儲存到歷史紀錄
    const record = {
        direction, entry, stoploss, loss, leverage, tp,
        stopPercent: (stopPercent * 100).toFixed(2),
        positionValue: positionValue.toFixed(2),
        margin: margin.toFixed(2),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tradeResult: '',
        tradeR: ''
    };
    history.unshift(record);
    saveHistory();
    renderHistory();
}

// ======================
// 歷史紀錄
// ======================
function saveHistory() {
    if (!sessionUser) return;
    localStorage.setItem(`calcHistory:${sessionUser.email}`, JSON.stringify(history));
}

function loadHistory() {
    if (!sessionUser) return;
    const data = localStorage.getItem(`calcHistory:${sessionUser.email}`);
    if (data) history = JSON.parse(data);
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    historyList.innerHTML = '';
    history.forEach((item, index) => {
        const row = document.createElement('tr');

        const fields = [
            'direction','entry','stoploss','loss','leverage','tp','tradeResult','tradeR'
        ];

        fields.forEach(f => {
            const td = document.createElement('td');
            td.textContent = item[f] ?? '';
            td.setAttribute('data-field', f);
            td.setAttribute('data-index', index);
            row.appendChild(td);
        });

        // 操作欄
        const actionTd = document.createElement('td');

        const editBtn = document.createElement('button');
        editBtn.textContent = '編輯';
        editBtn.className = 'text-blue-500 hover:underline';
        editBtn.addEventListener('click', () => {
            enterEditMode(row, item, index);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '刪除';
        deleteBtn.className = 'ml-2 text-red-500 hover:underline';
        deleteBtn.addEventListener('click', () => {
            if (confirm('確定要刪除這筆紀錄嗎？')) {
                history.splice(index, 1);
                saveHistory();
                renderHistory();
            }
        });

        actionTd.appendChild(editBtn);
        actionTd.appendChild(deleteBtn);
        row.appendChild(actionTd);

        historyList.appendChild(row);
    });
}

// 進入編輯模式
function enterEditMode(row, item, index) {
    row.classList.add('bg-yellow-50');
    row.innerHTML = '';

    const fields = [
        { key: 'direction', type: 'select', options: ['做多','做空'] },
        { key: 'entry', type: 'number' },
        { key: 'stoploss', type: 'number' },
        { key: 'loss', type: 'number' },
        { key: 'leverage', type: 'number' },
        { key: 'tp', type: 'number' },
        { key: 'tradeResult', type: 'text' },
        { key: 'tradeR', type: 'number' }
    ];

    const inputs = {};

    fields.forEach(f => {
        const td = document.createElement('td');
        let input;

        if (f.type === 'select') {
            input = document.createElement('select');
            f.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (opt === item[f.key]) option.selected = true;
                input.appendChild(option);
            });
        } else {
            input = document.createElement('input');
            input.type = f.type;
            input.value = item[f.key] ?? '';
        }

        input.className = 'border p-1 w-full';
        input.setAttribute('data-field', f.key);
        input.setAttribute('data-index', index);

        // 🔄 即時同步
        input.addEventListener('input', () => {
            history[index][f.key] = input.value;
            document.querySelectorAll(`input[data-field="${f.key}"][data-index="${index}"]`)
                .forEach(el => {
                    if (el !== input) el.value = input.value;
                });
        });

        inputs[f.key] = input;
        td.appendChild(input);
        row.appendChild(td);
    });

    // 操作按鈕
    const actionTd = document.createElement('td');
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'text-green-600 hover:underline';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'ml-2 text-gray-500 hover:underline';

    saveBtn.addEventListener('click', () => {
        Object.keys(inputs).forEach(key => {
            item[key] = inputs[key].value;
        });
        item.updatedAt = new Date().toISOString();

        const { positionValue, margin } = calculateFromHistory(item);
        item.positionValue = positionValue;
        item.margin = margin;

        saveHistory();
        renderHistory();
    });

    cancelBtn.addEventListener('click', () => {
        renderHistory();
    });

    actionTd.appendChild(saveBtn);
    actionTd.appendChild(cancelBtn);
    row.appendChild(actionTd);
}

// 計算工具：根據歷史紀錄重算
function calculateFromHistory(item) {
    const entry = parseFloat(item.entry);
    const stoploss = parseFloat(item.stoploss);
    const loss = parseFloat(item.loss);
    const leverage = parseFloat(item.leverage);

    if (isNaN(entry) || isNaN(stoploss) || isNaN(loss) || isNaN(leverage)) {
        return { positionValue: 0, margin: 0 };
    }

    const stopDiff = item.direction === '做多' ? entry - stoploss : stoploss - entry;
    const stopPercent = stopDiff / entry;
    const positionValue = loss / stopPercent;
    const margin = positionValue / leverage;

    return { positionValue: positionValue.toFixed(2), margin: margin.toFixed(2) };
}

// ======================
// GitHub 雲端同步
// ======================
async function syncToCloud() {
    if (!APP_CLOUD.token || !sessionUser) return;
    const path = `${APP_CLOUD.basePath}/${sessionUser.email}.json`;
    const url = `https://api.github.com/repos/${APP_CLOUD.repo}/contents/${path}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(history, null, 2))));

    let sha = null;
    try {
        const res = await fetch(url, { headers: { Authorization: `token ${APP_CLOUD.token}` } });
        if (res.ok) {
            const data = await res.json();
            sha = data.sha;
        }
    } catch {}

    await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `token ${APP_CLOUD.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `update ${sessionUser.email} history`,
            content,
            sha,
            branch: APP_CLOUD.branch
        })
    });
}

async function syncFromCloud() {
    if (!APP_CLOUD.token || !sessionUser) return;
    const path = `${APP_CLOUD.basePath}/${sessionUser.email}.json`;
    const url = `https://api.github.com/repos/${APP_CLOUD.repo}/contents/${path}`;
    try {
        const res = await fetch(url, { headers: { Authorization: `token ${APP_CLOUD.token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const remote = JSON.parse(decodeURIComponent(escape(atob(data.content))));

        // 合併：取 updatedAt 最新的
        const merged = [];
        const map = {};
        [...history, ...remote].forEach(r => {
            const key = `${r.entry}_${r.stoploss}_${r.loss}_${r.leverage}_${r.createdAt}`;
            if (!map[key] || new Date(r.updatedAt) > new Date(map[key].updatedAt)) {
                map[key] = r;
            }
        });
        for (const k in map) merged.push(map[k]);
        history = merged.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        saveHistory();
    } catch {}
}
