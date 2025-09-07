document.addEventListener("DOMContentLoaded", () => {
  const resultDiv = document.getElementById("result");
  const historyDiv = document.getElementById("history");
  const clearBtn = document.getElementById("clearHistory");
  // 簡易封裝：取得/寫入歷史紀錄
  function getHistory() {
    return JSON.parse(localStorage.getItem("calcHistory") || "[]");
  }
  function setHistory(list) {
    localStorage.setItem("calcHistory", JSON.stringify(list));
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

  // 當前選中的比例（預設 0）
  let presetPercents = { tp1: 0, tp2: 0, tp3: 0 };

  document.getElementById("calculate").addEventListener("click", () => {
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

    // 開倉張數（合約數）= M / 每合約風險
    const contracts = M / riskPerContract;

    // 各 TP 平倉倉位價值（以 USDT 計），用比例占比乘上總倉位價值
    function calcTpCloseValue(pct) {
      if (!pct || pct <= 0) return 0;
      // 以倉位價值比例計算要平倉的價值（與目標價無關）
      const closeValue = positionValue * (pct / 100);
      return closeValue;
    }

    const tp1CloseValue = calcTpCloseValue(tp1Pct);
    const tp2CloseValue = calcTpCloseValue(tp2Pct);
    const tp3CloseValue = calcTpCloseValue(tp3Pct);

    const resultText = `
      <div><strong>幣種</strong>：${symbol}</div>
      <div><strong>止損幅度</strong>：${stopPercent}%</div>
      <div><strong>倉位價值</strong>：${positionValue.toFixed(2)} U</div>
      <div><strong>需保證金</strong>：${margin.toFixed(2)} U</div>
      ${totalClosePct > 0 ? `
      <div style="margin:6px 0;border-top:1px solid #e5e7eb;"></div>
      <div><strong>止盈比例</strong>：${tp1Pct}/${tp2Pct}/${tp3Pct}</div>
      ${tp1Pct>0 ? `<div>TP1：價 ${isNaN(tp1Price)||tp1Price<=0?'-':tp1Price} ｜ 比例 ${tp1Pct}% ｜ 平倉價值 ≈ <b>${tp1CloseValue.toFixed(2)} USDT</b></div>` : ''}
      ${tp2Pct>0 ? `<div>TP2：價 ${isNaN(tp2Price)||tp2Price<=0?'-':tp2Price} ｜ 比例 ${tp2Pct}% ｜ 平倉價值 ≈ <b>${tp2CloseValue.toFixed(2)} USDT</b></div>` : ''}
      ${tp3Pct>0 ? `<div>TP3：價 ${isNaN(tp3Price)||tp3Price<=0?'-':tp3Price} ｜ 比例 ${tp3Pct}% ｜ 平倉價值 ≈ <b>${tp3CloseValue.toFixed(2)} USDT</b></div>` : ''}
      ` : ''}
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
        tp1: { pct: tp1Pct || 0, price: isNaN(tp1Price)? null : tp1Price, closeValue: tp1CloseValue.toFixed(2) },
        tp2: { pct: tp2Pct || 0, price: isNaN(tp2Price)? null : tp2Price, closeValue: tp2CloseValue.toFixed(2) },
        tp3: { pct: tp3Pct || 0, price: isNaN(tp3Price)? null : tp3Price, closeValue: tp3CloseValue.toFixed(2) },
        totalPct: Math.min(100, totalClosePct)
      },
      time: new Date().toLocaleString()
    });

    loadHistory();
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
      div.innerHTML = `
        <b>${r.time}</b><br>
        <strong>幣種:</strong> ${r.symbol}<br>
        <strong>方向:</strong> ${r.direction === 'long' ? '做多 📈' : '做空 📉'}, <strong>槓桿:</strong> ${r.leverage}x<br>
        <strong>進場:</strong> ${r.entry}, <strong>止損:</strong> ${r.stop}, <strong>允許虧損:</strong> ${r.maxLoss}<br>
        📉 <strong>止損幅度:</strong> ${r.stopPercent}%<br>
        💰 <strong>倉位:</strong> ${r.positionValue} U<br>
        🏦 <strong>保證金:</strong> ${r.margin} U<br>
        ${tp ? `
        🎯 <strong>止盈計畫:</strong> 總比例 ${tp.totalPct}%<br>
        TP1: 價 ${tp.tp1.price ?? '-'}，${tp.tp1.pct}% ，平倉價值 ${tp.tp1.closeValue} U<br>
        TP2: 價 ${tp.tp2.price ?? '-'}，${tp.tp2.pct}% ，平倉價值 ${tp.tp2.closeValue} U<br>
        TP3: 價 ${tp.tp3.price ?? '-'}，${tp.tp3.pct}% ，平倉價值 ${tp.tp3.closeValue} U<br>
        ` : ''}
      `;
      // 可編輯：TP 結果 與 R 值
      const editWrap = document.createElement("div");
      editWrap.style.display = "grid";
      editWrap.style.gridTemplateColumns = "1fr 1fr auto";
      editWrap.style.gap = "6px";
      editWrap.style.marginTop = "6px";

      const tpInput = document.createElement("input");
      tpInput.type = "text";
      tpInput.placeholder = "TP 結果(例如: TP2)";
      tpInput.value = r.tpResult || "";

      const rInput = document.createElement("input");
      rInput.type = "number";
      rInput.step = "0.01";
      rInput.placeholder = "R 值";
      rInput.value = r.rValue || "";

      const saveBtn = document.createElement("button");
      saveBtn.textContent = "保存";
      saveBtn.addEventListener("click", () => {
        updateRecord(i, { tpResult: tpInput.value.trim(), rValue: rInput.value === '' ? null : parseFloat(rInput.value) });
        loadHistory();
      });

      editWrap.appendChild(tpInput);
      editWrap.appendChild(rInput);
      editWrap.appendChild(saveBtn);
      div.appendChild(editWrap);

      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️ 刪除";
      delBtn.style.marginTop = "6px";
      delBtn.addEventListener("click", () => deleteRecord(i));
      div.appendChild(delBtn);
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
