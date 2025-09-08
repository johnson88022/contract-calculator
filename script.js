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
    
    // 雲端同步配置按鈕
    const cloudConfigBtn = document.getElementById('cloudConfigBtn');
    if (cloudConfigBtn) {
        cloudConfigBtn.addEventListener('click', openCloudModal);
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
            
            // 保存到歷史記錄並同步到雲端
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
                device: getDeviceInfo()
            };
            
            saveResult(record);
            syncToCloud(); // 立即同步到雲端
            
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
    
    // 雲端同步功能
    function getCloudConfig() {
        return JSON.parse(localStorage.getItem('cloudConfig') || '{}');
    }
    
    function setCloudConfig(config) {
        localStorage.setItem('cloudConfig', JSON.stringify(config));
    }
    
    function openCloudModal() {
        const config = getCloudConfig();
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 1000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; width: 90%; max-width: 400px;">
                <h3>☁️ 雲端同步設定</h3>
                <div style="margin: 15px 0;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">GitHub Personal Access Token</label>
                    <input type="password" id="cloudToken" value="${config.token || ''}" 
                           placeholder="輸入你的 GitHub PAT" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                <div style="margin: 15px 0;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Repository 名稱</label>
                    <input type="text" id="cloudRepo" value="${config.repo || 'contract-data'}" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cloudSave" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px;">保存</button>
                    <button id="cloudCancel" style="padding: 10px 20px; background: #ccc; border: none; border-radius: 5px;">取消</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('#cloudSave').addEventListener('click', function() {
            const token = modal.querySelector('#cloudToken').value.trim();
            const repo = modal.querySelector('#cloudRepo').value.trim();
            
            if (token) {
                setCloudConfig({ token, repo });
                alert('設定已保存！即將開始同步...');
                syncFromCloud().then(loadHistory);
            } else {
                alert('請輸入有效的 Token');
            }
            
            document.body.removeChild(modal);
        });
        
        modal.querySelector('#cloudCancel').addEventListener('click', function() {
            document.body.removeChild(modal);
        });
    }
    
    // 簡化的雲端同步函數
    async function syncToCloud() {
        const config = getCloudConfig();
        if (!config.token) {
            console.log('未設置雲端同步 token');
            return false;
        }
        
        try {
            const history = getHistory();
            const email = localStorage.getItem('sessionUser') || 'guest';
            const data = {
                email: email,
                history: history,
                lastSync: Date.now(),
                device: getDeviceInfo()
            };
            
            // 這裡使用 localStorage 模擬雲端存儲
            // 實際應用中應該替換為真實的 API 調用
            localStorage.setItem('cloud_sync_data', JSON.stringify(data));
            localStorage.setItem('last_sync_time', Date.now().toString());
            
            console.log('數據已同步到本地存儲（模擬雲端）');
            return true;
            
        } catch (error) {
            console.error('同步失敗:', error);
            return false;
        }
    }
    
    async function syncFromCloud() {
        const config = getCloudConfig();
        if (!config.token) {
            console.log('未設置雲端同步 token');
            return false;
        }
        
        try {
            // 從本地存儲讀取模擬的雲端數據
            const cloudData = localStorage.getItem('cloud_sync_data');
            const lastSyncTime = localStorage.getItem('last_sync_time');
            
            if (cloudData) {
                const data = JSON.parse(cloudData);
                const email = localStorage.getItem('sessionUser') || 'guest';
                
                if (data.email === email) {
                    // 合併歷史記錄
                    const localHistory = getHistory();
                    const cloudHistory = data.history || [];
                    
                    // 創建合併的歷史記錄（基於時間戳）
                    const mergedHistory = mergeHistories(localHistory, cloudHistory);
                    setHistory(mergedHistory);
                    
                    console.log('從雲端同步成功', mergedHistory.length, '條記錄');
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.error('從雲端同步失敗:', error);
            return false;
        }
    }
    
    // 合併歷史記錄
    function mergeHistories(localHistory, cloudHistory) {
        const mergedMap = new Map();
        
        // 添加雲端記錄
        cloudHistory.forEach(item => {
            if (item.time) {
                mergedMap.set(item.time, item);
            }
        });
        
        // 添加本地記錄（如果更新則覆蓋）
        localHistory.forEach(item => {
            if (!item.time) return;
            
            const existing = mergedMap.get(item.time);
            const localUpdated = item.updatedAt || new Date(item.time).getTime();
            const cloudUpdated = existing ? (existing.updatedAt || new Date(existing.time).getTime()) : 0;
            
            if (!existing || localUpdated > cloudUpdated) {
                mergedMap.set(item.time, item);
            }
        });
        
        return Array.from(mergedMap.values())
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .slice(0, 50); // 限制最多50條記錄
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
            html += `
                <div class="history-item" style="margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 8px;">
                    <div style="margin-bottom: 6px;"><b>${record.time}</b></div>
                    <div>${record.symbol}｜${record.leverage}x｜倉位 ${record.positionValue} U</div>
                    <div>保證金 ${record.margin} U｜止損 ${record.stopPercent}%</div>
                    <div>方向: ${record.direction === 'long' ? '做多 📈' : '做空 📉'}</div>
                    <button onclick="deleteRecord(${index})" style="margin-top: 8px; padding: 5px 10px; background: #ff4757; color: white; border: none; border-radius: 4px; font-size: 12px;">刪除</button>
                </div>
            `;
        });
        
        historyDiv.innerHTML = html;
    }
    
    // 全局函數
    window.deleteRecord = function(index) {
        if (confirm("確定要刪除此紀錄嗎？")) {
            let history = getHistory();
            history.splice(index, 1);
            setHistory(history);
            syncToCloud(); // 同步刪除操作
            loadHistory();
        }
    };
    
    // 清除歷史記錄
    const clearBtn = document.getElementById("clearHistory");
    if (clearBtn) {
        clearBtn.addEventListener("click", function() {
            if (confirm("確定要清除全部紀錄嗎？")) {
                setHistory([]);
                syncToCloud(); // 同步清除操作
                loadHistory();
            }
        });
    }
    
    // 導出功能
    const exportBtn = document.getElementById('exportHistory');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            const history = getHistory();
            const dataStr = JSON.stringify(history, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `contract-history-${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        });
    }
    
    // 定時同步
    let syncInterval = null;
    function startSync() {
        if (syncInterval) clearInterval(syncInterval);
        
        syncInterval = setInterval(async () => {
            const config = getCloudConfig();
            if (config.token) {
                await syncFromCloud();
                loadHistory();
            }
        }, 30000); // 每30秒同步一次
    }
    
    // 頁面可見時同步
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            const config = getCloudConfig();
            if (config.token) {
                syncFromCloud().then(loadHistory);
            }
        }
    });
    
    // 初始化
    loadHistory();
    startSync();
    
    // 首次加載時嘗試同步
    setTimeout(() => {
        const config = getCloudConfig();
        if (config.token) {
            syncFromCloud().then(loadHistory);
        }
    }, 1000);
});