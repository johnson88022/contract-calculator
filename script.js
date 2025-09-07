document.addEventListener("DOMContentLoaded", () => {
  const resultDiv = document.getElementById("result");
  const historyDiv = document.getElementById("history");
  const clearBtn = document.getElementById("clearHistory");

  loadHistory();

  document.getElementById("calculate").addEventListener("click", () => {
    const L = parseFloat(document.getElementById("leverage").value);
    const dir = document.getElementById("direction").value;
    const E = parseFloat(document.getElementById("entry").value);
    const S = parseFloat(document.getElementById("stop").value);
    const M = parseFloat(document.getElementById("maxLoss").value);
    const symbol = document.getElementById("symbol").value.trim() || "未輸入";
    const tp1Pct = parseFloat(document.getElementById("tp1Pct")?.value || "0");
    const tp2Pct = parseFloat(document.getElementById("tp2Pct")?.value || "0");
    const tp3Pct = parseFloat(document.getElementById("tp3Pct")?.value || "0");
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
    function calcTpCloseValue(pct, price) {
      if (!pct || pct <= 0 || isNaN(price) || price <= 0) return 0;
      // 以倉位價值比例計算要平倉的價值
      const closeValue = positionValue * (pct / 100);
      return closeValue;
    }

    const tp1CloseValue = calcTpCloseValue(tp1Pct, tp1Price);
    const tp2CloseValue = calcTpCloseValue(tp2Pct, tp2Price);
    const tp3CloseValue = calcTpCloseValue(tp3Pct, tp3Price);

    const resultText = `
      幣種: ${symbol}<br>
      📉 止損幅度: ${stopPercent}%<br>
      💰 倉位價值: ${positionValue.toFixed(2)} USDT<br>
      🏦 需保證金: ${margin.toFixed(2)} USDT<br>
      ${totalClosePct > 0 ? `
      <hr>
      🎯 止盈計畫（總平倉比例: ${Math.min(100, totalClosePct)}%）<br>
      TP1: ${isNaN(tp1Price) || tp1Price<=0 ? '-' : tp1Price} ，比例 ${tp1Pct || 0}% ，平倉價值 ≈ ${tp1CloseValue.toFixed(2)} USDT<br>
      TP2: ${isNaN(tp2Price) || tp2Price<=0 ? '-' : tp2Price} ，比例 ${tp2Pct || 0}% ，平倉價值 ≈ ${tp2CloseValue.toFixed(2)} USDT<br>
      TP3: ${isNaN(tp3Price) || tp3Price<=0 ? '-' : tp3Price} ，比例 ${tp3Pct || 0}% ，平倉價值 ≈ ${tp3CloseValue.toFixed(2)} USDT
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
    let history = JSON.parse(localStorage.getItem("calcHistory") || "[]");
    history.unshift(record);
    if (history.length > 20) history = history.slice(0, 20);
    localStorage.setItem("calcHistory", JSON.stringify(history));
  }

  function deleteRecord(index) {
    showConfirm("確定要刪除此紀錄嗎？", () => {
      let history = JSON.parse(localStorage.getItem("calcHistory") || "[]");
      history.splice(index, 1);
      localStorage.setItem("calcHistory", JSON.stringify(history));
      loadHistory();
    });
  }

  function loadHistory() {
    const history = JSON.parse(localStorage.getItem("calcHistory") || "[]");
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
        💰 <strong>倉位:</strong> ${r.positionValue} USDT<br>
        🏦 <strong>保證金:</strong> ${r.margin} USDT<br>
        ${tp ? `
        🎯 <strong>止盈計畫:</strong> 總比例 ${tp.totalPct}%<br>
        TP1: 價 ${tp.tp1.price ?? '-'}，${tp.tp1.pct}% ，平倉價值 ${tp.tp1.closeValue} USDT<br>
        TP2: 價 ${tp.tp2.price ?? '-'}，${tp.tp2.pct}% ，平倉價值 ${tp.tp2.closeValue} USDT<br>
        TP3: 價 ${tp.tp3.price ?? '-'}，${tp.tp3.pct}% ，平倉價值 ${tp.tp3.closeValue} USDT<br>
        ` : ''}
      `;
      const btn = document.createElement("button");
      btn.textContent = "🗑️ 刪除";
      btn.addEventListener("click", () => deleteRecord(i));
      div.appendChild(btn);
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
