// Webページからのメッセージをリッスン
window.addEventListener("message", (event) => {
  // 自分のページからのメッセージのみ処理
  if (event.source !== window) return;

  if (event.data.type === "MIERO_OPEN_PATH") {
    const path = event.data.path;

    // バックグラウンドスクリプトにメッセージを送信
    chrome.runtime.sendMessage(
      { action: "openPath", path: path },
      (response) => {
        if (response && response.success) {
          console.log("Path opened successfully:", path);
        } else {
          console.error("Failed to open path:", response?.error || "Unknown error");
          // フォールバック: クリップボードにコピー
          navigator.clipboard.writeText(path).then(() => {
            alert(`パスをクリップボードにコピーしました:\n${path}`);
          });
        }
      }
    );
  }
});

// 拡張機能が読み込まれたことをページに通知
window.postMessage({ type: "MIERO_EXTENSION_READY" }, "*");
