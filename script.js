// 簡化版的 script.js，專注於修復計算功能
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
        
        // 初始更新視圖
        updateView();
    }
    
    // 計算按鈕事件綁定 - 使用最簡單可靠的方式
    const calculateBtn = document.getElementById("calculate");
    const resultDiv = document.getElementById("result");
    
    if (calculateBtn && resultDiv) {
        console.log("找到計算按鈕和結果區域");
        
        calculateBtn.addEventListener("click", function() {
            console.log("計算按鈕被點擊");
            calculatePosition();
        });
    } else {
        console.error("計算按鈕或結果區域未找到:", {
            calculateBtn: !!calculateBtn,
            resultDiv: !!resultDiv
        });
    }
    
    // 計算倉位函數
    function calculatePosition() {
        console.log("開始計算倉位");
        
        try {
            // 獲取輸入值
            const L = parseFloat(document.getElementById("leverage").value) || 0;
            const dir = document.getElementById("direction").value;
            const E = parseFloat(document.getElementById("entry").value) || 0;
            const S = parseFloat(document.getElementById("stop").value) || 0;
            const M = parseFloat(document.getElementById("maxLoss").value) || 0;
            const symbol = document.getElementById("symbol").value.trim() || "未輸入";
            
            console.log("輸入值:", { L, dir, E, S, M, symbol });
            
            // 驗證輸入
            if (E <= 0 || S <= 0 || M <= 0) {
                resultDiv.innerHTML = "⚠ 請輸入有效的數值（必須大於0）";
                return;
            }
            
            if (E === S) {
                resultDiv.innerHTML = "⚠ 進場價和止損價不能相同";
                return;
            }
            
            // 計算風險
            let riskPerContract = dir === "long" ? (E - S) : (S - E);
            if (riskPerContract <= 0) {
                resultDiv.innerHTML = "⚠ 止損方向錯誤，請確認數值";
                return;
            }
            
            // 計算結果
            const stopPercent = ((Math.abs(E - S) / E) * 100).toFixed(2);
            const positionValue = (M / riskPerContract) * E;
            const margin = positionValue / L;
            
            console.log("計算結果:", { stopPercent, positionValue, margin });
            
            // 顯示結果
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
            
            // 保存到歷史記錄
            saveResult({
                leverage: L,
                direction: dir,
                entry: E,
                stop: S,
                maxLoss: M,
                stopPercent: stopPercent,
                positionValue: positionValue.toFixed(2),
                margin: margin.toFixed(2),
                symbol: symbol,
                time: new Date().toLocaleString()
            });
            
            // 重新加載歷史記錄
            loadHistory();
            
        } catch (err) {
            console.error("計算錯誤:", err);
            resultDiv.innerHTML = "⚠ 計算時發生錯誤，請檢查輸入或重新整理頁面";
        }
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
        if (history.length > 20) {
            history = history.slice(0, 20);
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
                <div class="history-item">
                    <div style="margin-bottom: 6px;"><b>${record.time}</b></div>
                    <div>${record.symbol}｜${record.leverage}x｜倉位 ${record.positionValue} U｜保證金 ${record.margin} U</div>
                    <div>進場 ${record.entry}｜止損 ${record.stopPercent}%｜方向 ${record.direction === 'long' ? '做多' : '做空'}</div>
                    <button onclick="deleteRecord(${index})" style="margin-top: 6px; padding: 4px 8px; font-size: 12px;">刪除</button>
                </div>
            `;
        });
        
        historyDiv.innerHTML = html;
    }
    
    // 全局函數供按鈕調用
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
    
    // 初始加載歷史記錄
    loadHistory();
    
    // 添加調試信息
    console.log("頁面初始化完成");
    console.log("當前用戶:", localStorage.getItem('sessionUser'));
});