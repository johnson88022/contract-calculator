document.addEventListener("DOMContentLoaded", () => {
  // 未登入導向登入頁
  const currentUser = localStorage.getItem('sessionUser');
  if (!currentUser) {
    if (location.pathname.endsWith('index.html') || location.pathname === '/' || location.pathname === '') {
      location.href = 'login.html';
      return;
    }
  }
  const resultDiv = document.getElementById("result");
  const historyDiv = document.getElementById("history");
  const clearBtn = document.getElementById("clearHistory");
  const userInfoEl = document.getElementById('userInfo');
  const logoutBtn = document.getElementById('logoutBtn');
  if (userInfoEl) {
    const email = localStorage.getItem('sessionUser');
    userInfoEl.textContent = email ? `已登入：${email}` : '未登入';
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('sessionUser');
      location.href = 'login.html';
    });
  }

  // 匯出／匯入歷史：用於跨裝置同步（純本地文件）
  const exportBtn = document.getElementById('exportHistory');
  const importBtn = document.getElementById('importHistoryBtn');
  const importFile = document.getElementById('importHistory');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const email = localStorage.getItem('sessionUser') || 'guest';
      const history = getHistory();
      const blob = new Blob([JSON.stringify({ email, history }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `history-${email}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Array.isArray(data.history)) throw new Error('format');
          setHistory(data.history);
          loadHistory();
          alert('匯入完成');
        } catch (err) {
          alert('匯入失敗，檔案格式錯誤');
        }
      };
      reader.readAsText(file);
    });
  }
  // 當前選中的比例（預設 0）- 提前宣告避免初次更新視圖報錯
  let presetPercents = { tp1: 0, tp2: 0, tp3: 0 };
  // 簡易封裝：取得/寫入歷史紀錄
  function getHistory() {
    const email = localStorage.getItem('sessionUser') || 'guest';
    return JSON.parse(localStorage.getItem(`calcHistory:${email}`) || "[]");
  }
  function setHistory(list) {
    const email = localStorage.getItem('sessionUser') || 'guest';
    localStorage.setItem(`calcHistory:${email}`, JSON.stringify(list));
  }


  loadHistory();

  // 止盈方案選單：自動填入 TP 百分比
  const presetEl = document.getElementById("tpPreset");
  if (presetEl) {
    const updateView = () => {
      const view = document.getElementById("tpPctView");
      if (view) view.textContent = `目前比例：${presetPercents.tp1}/${presetPercents.tp2}/${presetPercents.tp3}`;
    };
    presetEl.addEventListener("change", () => {
      const val = presetEl.value; // e.g., "50-30-20"
      if (!val) { presetPercents = { tp1: 0, tp2: 0, tp3: 0 }; updateView(); return; }
      const [p1, p2, p3] = val.split("-").map((v) => parseFloat(v));
      presetPercents = {
        tp1: isNaN(p1) ? 0 : p1,
        tp2: isNaN(p2) ? 0 : p2,
        tp3: isNaN(p3) ? 0 : p3
      };
      updateView();
    });
    // 初始就更新一次視圖（避免首次不顯示）
    updateView();
  }

  // 當前選中的比例（上方已宣告）

  document.getElementById("calculate").addEventListener("click", () => {
    try {
    const L = parseFloat(document.getElementById("leverage").value);
    const dir = document.getElementById("direction").value;
    const E = parseFloat(document.getElementById("entry").value);
    const S = parseFloat(document.getElementById("stop").value);
    const M = parseFloat(document.getElementById("maxLoss").value);
    const symbol = document.getElementById("symbol").value.trim() || "未輸入";
    const tp1Pct = presetPercents.tp1 || 0;
    const tp2Pct = presetPercents.tp2 || 0;
    const tp3Pct = presetPercents.tp3 || 0;
    const tp1Price = parseFloat(document.getElementById("tp1Price")?.value || "0");
    const tp2Price = parseFloat(document.getElementById("tp2Price")?.value || "0");
    const tp3Price = parseFloat(document.getElementById("tp3Price")?.value || "0");

    if (isNaN(E) || isNaN(S) || isNaN(M)) {
      resultDiv.innerHTML = "⚠ 請輸入完整數值";
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

    const totalClosePct = [tp1Pct, tp2Pct, tp3Pct].reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
    const showTPBlock = (tp1Pct>0 || tp2Pct>0 || tp3Pct>0 || (tp1Price>0) || (tp2Price>0) || (tp3Price>0));

    // 開倉張數（合約數）= M / 每合約風險
    const contracts = M / riskPerContract;

    // 各 TP 平倉倉位價值（以 U 計），用比例占比乘上總倉位價值
    function calcTpCloseValue(pct) {
      if (!pct || pct <= 0) return 0;
      // 以倉位價值比例計算要平倉的價值（與目標價無關）
      const closeValue = positionValue * (pct / 100);
      return closeValue;
    }

    const tp1CloseValue = calcTpCloseValue(tp1Pct);
    const tp2CloseValue = calcTpCloseValue(tp2Pct);
    const tp3CloseValue = calcTpCloseValue(tp3Pct);

    // 各 TP 預期盈利（以 U 計）：依各 TP 自身平倉比例計算，不累加
    function calcChangePct(tpPrice) {
      if (isNaN(tpPrice) || tpPrice <= 0) return 0;
      return dir === "long" ? (tpPrice - E) / E : (E - tpPrice) / E;
    }
    const p1 = Math.max(0, (tp1Pct || 0)) / 100;
    const p2 = Math.max(0, (tp2Pct || 0)) / 100;
    const p3 = Math.max(0, (tp3Pct || 0)) / 100;

    const seg1 = positionValue * p1 * calcChangePct(tp1Price);
    const seg2 = positionValue * p2 * calcChangePct(tp2Price);
    const seg3 = positionValue * p3 * calcChangePct(tp3Price);

    const tp1Profit = seg1;
    const tp2Profit = seg1 + seg2;
    const tp3Profit = seg1 + seg2 + seg3;

    const summaryLine = `${symbol}｜${dir === 'long' ? '做多' : '做空'} ${L}x｜倉位 ${positionValue.toFixed(2)} U｜保證金 ${margin.toFixed(2)} U｜止損 ${stopPercent}%`;

    const detailsBlock = `
      <div><strong>方向</strong>：${dir === 'long' ? '做多 📈' : '做空 📉'}，<strong>槓桿</strong>：${L}x</div>
      <div><strong>進場</strong>：${E}｜<strong>止損</strong>：${S}｜<strong>允許虧損</strong>：${M}</div>
      <div><strong>倉位價值</strong>：${positionValue.toFixed(2)} U｜<strong>需保證金</strong>：${margin.toFixed(2)} U</div>
      <div><strong>止損幅度</strong>：${stopPercent}%</div>
      ${showTPBlock ? `
        <div style="margin:6px 0;border-top:1px solid #e5e7eb;"></div>
        <div><strong>止盈比例</strong>：${tp1Pct}/${tp2Pct}/${tp3Pct}</div>
        ${tp1Pct>0 ? `<div>TP1：價 ${isNaN(tp1Price)||tp1Price<=0?'-':tp1Price} ｜ 比例 ${tp1Pct}% ｜ 平倉價值 ≈ <b>${tp1CloseValue.toFixed(2)} U</b> ｜ 預期盈利 ≈ <b>${tp1Profit.toFixed(2)} U</b></div>` : ''}
        ${tp2Pct>0 ? `<div>TP2：價 ${isNaN(tp2Price)||tp2Price<=0?'-':tp2Price} ｜ 比例 ${tp2Pct}% ｜ 平倉價值 ≈ <b>${tp2CloseValue.toFixed(2)} U</b> ｜ 預期盈利 ≈ <b>${tp2Profit.toFixed(2)} U</b></div>` : ''}
        ${tp3Pct>0 ? `<div>TP3：價 ${isNaN(tp3Price)||tp3Price<=0?'-':tp3Price} ｜ 比例 ${tp3Pct}% ｜ 平倉價值 ≈ <b>${tp3CloseValue.toFixed(2)} U</b> ｜ 預期盈利 ≈ <b>${tp3Profit.toFixed(2)} U</b></div>` : ''}
      ` : ''}
    `;

    const tpTable = showTPBlock ? `
      <table class="tp-table">
        <thead>
          <tr><th>TP</th><th>價位</th><th>比例</th><th>平倉價值</th><th>預期盈虧</th></tr>
        </thead>
        <tbody>
          ${tp1Pct>0 ? `<tr><td>TP1</td><td>${isNaN(tp1Price)||tp1Price<=0?'-':tp1Price}</td><td>${tp1Pct}%</td><td>${tp1CloseValue.toFixed(2)} U</td><td>${tp1Profit.toFixed(2)} U</td></tr>` : ''}
          ${tp2Pct>0 ? `<tr><td>TP2</td><td>${isNaN(tp2Price)||tp2Price<=0?'-':tp2Price}</td><td>${tp2Pct}%</td><td>${tp2CloseValue.toFixed(2)} U</td><td>${tp2Profit.toFixed(2)} U</td></tr>` : ''}
          ${tp3Pct>0 ? `<tr><td>TP3</td><td>${isNaN(tp3Price)||tp3Price<=0?'-':tp3Price}</td><td>${tp3Pct}%</td><td>${tp3CloseValue.toFixed(2)} U</td><td>${tp3Profit.toFixed(2)} U</td></tr>` : ''}
        </tbody>
      </table>
    ` : '';

    const resultText = `
      <details>
        <summary class="result-summary" style="cursor:pointer;outline:none;">
          ${summaryLine}<span class="result-hint">點擊展開詳情</span>
        </summary>
        <div class="result-details">
          ${detailsBlock}
          ${tpTable}
        </div>
      </details>
    `;

    resultDiv.innerHTML = resultText;

    saveResult({
      leverage: L,
      direction: dir,
      entry: E,
      stop: S,
      maxLoss: M,
      stopPercent,
      positionValue: positionValue.toFixed(2),
      margin: margin.toFixed(2),
      symbol,
      tp: {
        tp1: { pct: tp1Pct || 0, price: isNaN(tp1Price)? null : tp1Price, closeValue: tp1CloseValue.toFixed(2), profit: isNaN(tp1Profit)? null : tp1Profit.toFixed(2) },
        tp2: { pct: tp2Pct || 0, price: isNaN(tp2Price)? null : tp2Price, closeValue: tp2CloseValue.toFixed(2), profit: isNaN(tp2Profit)? null : tp2Profit.toFixed(2) },
        tp3: { pct: tp3Pct || 0, price: isNaN(tp3Price)? null : tp3Price, closeValue: tp3CloseValue.toFixed(2), profit: isNaN(tp3Profit)? null : tp3Profit.toFixed(2) },
        totalPct: Math.min(100, totalClosePct)
      },
      time: new Date().toLocaleString()
    });

    loadHistory();
    } catch (err) {
      console.error(err);
      resultDiv.innerHTML = "⚠ 計算時發生錯誤，請檢查輸入或重新整理頁面";
    }
  });

  clearBtn.addEventListener("click", () => {
    showConfirm("確定要清除全部紀錄嗎？", () => {
      localStorage.removeItem("calcHistory");
      loadHistory();
    });
  });

  function saveResult(record) {
    let history = getHistory();
    history.unshift(record);
    if (history.length > 20) history = history.slice(0, 20);
    setHistory(history);
  }

  function deleteRecord(index) {
    showConfirm("確定要刪除此紀錄嗎？", () => {
      let history = getHistory();
      history.splice(index, 1);
      setHistory(history);
      loadHistory();
    });
  }

  function updateRecord(index, fields) {
    const history = getHistory();
    if (!history[index]) return;
    history[index] = { ...history[index], ...fields };
    setHistory(history);
  }

  function loadHistory() {
    const history = getHistory();
    if (history.length === 0) {
      historyDiv.innerHTML = "尚無紀錄";
      return;
    }

    historyDiv.innerHTML = "";

    history.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "history-item";
      const tp = r.tp;
      const summary = `${r.symbol}｜${r.direction === 'long' ? '做多' : '做空'} ${r.leverage}x｜倉位 ${r.positionValue} U｜保證金 ${r.margin} U｜止損 ${r.stopPercent}%`;
      const tpTable = tp ? `
        <table class="tp-table">
          <thead>
            <tr><th>TP</th><th>價位</th><th>比例</th><th>平倉價值</th><th>預期盈虧</th></tr>
          </thead>
          <tbody>
            ${(tp.tp1?.pct||0)>0 || tp.tp1?.price ? `<tr><td>TP1</td><td>${tp.tp1.price ?? '-'}</td><td>${tp.tp1.pct}%</td><td>${tp.tp1.closeValue} U</td><td>${tp.tp1.profit ?? '-' } U</td></tr>` : ''}
            ${(tp.tp2?.pct||0)>0 || tp.tp2?.price ? `<tr><td>TP2</td><td>${tp.tp2.price ?? '-'}</td><td>${tp.tp2.pct}%</td><td>${tp.tp2.closeValue} U</td><td>${tp.tp2.profit ?? '-' } U</td></tr>` : ''}
            ${(tp.tp3?.pct||0)>0 || tp.tp3?.price ? `<tr><td>TP3</td><td>${tp.tp3.price ?? '-'}</td><td>${tp.tp3.pct}%</td><td>${tp.tp3.closeValue} U</td><td>${tp.tp3.profit ?? '-' } U</td></tr>` : ''}
          </tbody>
        </table>
      ` : '';

      div.innerHTML = `
        <div style="margin-bottom:6px;"><b>${r.time}</b></div>
        <details>
          <summary class="result-summary">${summary}<span class="result-hint">點擊展開詳情</span></summary>
          <div class="result-details">
            <div><strong>方向</strong>：${r.direction === 'long' ? '做多 📈' : '做空 📉'}，<strong>槓桿</strong>：${r.leverage}x</div>
            <div><strong>進場</strong>：${r.entry}｜<strong>止損</strong>：${r.stop}｜<strong>允許虧損</strong>：${r.maxLoss}</div>
            <div><strong>倉位價值</strong>：${r.positionValue} U｜<strong>需保證金</strong>：${r.margin} U</div>
            <div><strong>止損幅度</strong>：${r.stopPercent}%</div>
            ${tp ? `<div style=\"margin:6px 0;border-top:1px solid #e5e7eb;\"></div>` : ''}
            ${tp ? `<div><strong>止盈比例</strong>：${tp.tp1.pct}/${tp.tp2.pct}/${tp.tp3.pct}</div>` : ''}
            ${tpTable}
          </div>
        </details>
      `;
      // TP 結果 / R：文字檢視 與 編輯模式切換
      const controls = document.createElement("div");
      controls.style.display = "grid";
      controls.style.gridTemplateColumns = "1fr auto auto"; // 文本 | 編輯 | 刪除
      controls.style.gap = "6px";
      controls.style.alignItems = "center";
      controls.style.marginTop = "6px";

      const textSpan = document.createElement("div");
      const renderText = () => {
        const outcome = r.tpOutcome ? r.tpOutcome : "-";
        const rval = (r.rValue === 0 || r.rValue) ? r.rValue : "-";
        textSpan.textContent = `結果：${outcome} ｜ R：${rval}`;
      };
      renderText();

      const editBtn = document.createElement("button");
      editBtn.textContent = "編輯";

      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️ 刪除";
      delBtn.addEventListener("click", () => deleteRecord(i));

      const enterEditMode = () => {
        // 以選單與數字欄位替換文本與編輯鍵
        const tpSelect = document.createElement("select");
        ["", "TP1", "TP2", "TP3", "SL"].forEach(v => {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v === "" ? "選擇結果" : v;
          if ((r.tpOutcome || "") === v) opt.selected = true;
          tpSelect.appendChild(opt);
        });
        const rInput = document.createElement("input");
        rInput.type = "number"; rInput.step = "0.01"; rInput.placeholder = "R";
        rInput.value = (r.rValue === 0 || r.rValue) ? r.rValue : "";

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "保存";
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "取消";

        // 重新佈局：選單 | R | 保存 | 取消 | 刪除
        controls.innerHTML = "";
        controls.style.gridTemplateColumns = "auto auto auto auto auto";
        controls.appendChild(tpSelect);
        controls.appendChild(rInput);
        controls.appendChild(saveBtn);
        controls.appendChild(cancelBtn);
        controls.appendChild(delBtn);

        saveBtn.addEventListener("click", () => {
          const next = {
            tpOutcome: tpSelect.value || null,
            rValue: rInput.value === '' ? null : parseFloat(rInput.value)
          };
          updateRecord(i, next);
          // 更新本地 r 並恢復文字顯示
          r.tpOutcome = next.tpOutcome;
          r.rValue = next.rValue;
          // 回文字檢視：文本 | 編輯 | 刪除
          controls.innerHTML = "";
          controls.style.gridTemplateColumns = "1fr auto auto";
          renderText();
          controls.appendChild(textSpan);
          controls.appendChild(editBtn);
          controls.appendChild(delBtn);
        });
        cancelBtn.addEventListener("click", () => {
          // 回文字檢視
          controls.innerHTML = "";
          controls.style.gridTemplateColumns = "1fr auto auto";
          renderText();
          controls.appendChild(textSpan);
          controls.appendChild(editBtn);
          controls.appendChild(delBtn);
        });
      };

      editBtn.addEventListener("click", enterEditMode);

      // 初始渲染：文字 | 編輯 | 刪除
      controls.appendChild(textSpan);
      controls.appendChild(editBtn);
      controls.appendChild(delBtn);
      div.appendChild(controls);
      historyDiv.appendChild(div);
    });
  }

  // 自訂美觀的確認框
  function showConfirm(message, onConfirm) {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.6)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.style.padding = "20px";

    const box = document.createElement("div");
    box.style.background = "#fff";
    box.style.padding = "25px";
    box.style.borderRadius = "15px";
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
    box.style.textAlign = "center";
    box.style.maxWidth = "300px";
    box.style.width = "100%";
    box.innerHTML = `<p style="margin: 0 0 20px 0; font-size: 16px; color: #2d3748; line-height: 1.5;">${message}</p>`;

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.justifyContent = "center";

    const yesBtn = document.createElement("button");
    yesBtn.textContent = "✅ 確定";
    yesBtn.style.margin = "0";
    yesBtn.style.padding = "12px 20px";
    yesBtn.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    yesBtn.style.color = "#fff";
    yesBtn.style.border = "none";
    yesBtn.style.borderRadius = "8px";
    yesBtn.style.fontSize = "14px";
    yesBtn.style.fontWeight = "600";
    yesBtn.style.cursor = "pointer";
    yesBtn.style.flex = "1";
    yesBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
      onConfirm();
    });

    const noBtn = document.createElement("button");
    noBtn.textContent = "❌ 取消";
    noBtn.style.margin = "0";
    noBtn.style.padding = "12px 20px";
    noBtn.style.background = "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)";
    noBtn.style.color = "#fff";
    noBtn.style.border = "none";
    noBtn.style.borderRadius = "8px";
    noBtn.style.fontSize = "14px";
    noBtn.style.fontWeight = "600";
    noBtn.style.cursor = "pointer";
    noBtn.style.flex = "1";
    noBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });

    buttonContainer.appendChild(yesBtn);
    buttonContainer.appendChild(noBtn);
    box.appendChild(buttonContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
});
