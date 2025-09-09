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
    
    // 雲端同步功能與設定均已移除
    
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

            html += `
                <details class="history-item">
                    <summary style="cursor:pointer;">
                        <div style="margin-bottom: 6px;"><b>${record.time}</b></div>
                        <div>${record.symbol}｜${record.leverage}x｜倉位 ${record.positionValue} U</div>
                        <div>保證金 ${record.margin} U｜止損 ${record.stopPercent}%</div>
                        <div>方向: ${record.direction === 'long' ? '做多 📈' : '做空 📉'}</div>
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
                    <button onclick=\"deleteRecord(${index})\">刪除</button>
                </details>
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