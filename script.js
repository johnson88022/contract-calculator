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

    const resultText = `
      幣種: ${symbol}<br>
      📉 止損幅度: ${stopPercent}%<br>
      💰 倉位價值: ${positionValue.toFixed(2)} USDT<br>
      🏦 需保證金: ${margin.toFixed(2)} USDT
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
      div.innerHTML = `
        <b>${r.time}</b><br>
        <strong>幣種:</strong> ${r.symbol}<br>
        <strong>方向:</strong> ${r.direction === 'long' ? '做多 📈' : '做空 📉'}, <strong>槓桿:</strong> ${r.leverage}x<br>
        <strong>進場:</strong> ${r.entry}, <strong>止損:</strong> ${r.stop}, <strong>允許虧損:</strong> ${r.maxLoss}<br>
        📉 <strong>止損幅度:</strong> ${r.stopPercent}%<br>
        💰 <strong>倉位:</strong> ${r.positionValue} USDT<br>
        🏦 <strong>保證金:</strong> ${r.margin} USDT<br>
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
