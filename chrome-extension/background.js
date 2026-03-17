// Native Messaging ホスト名
const NATIVE_HOST = "com.miero.folder_opener";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openPath") {
    // Native Messaging を使用してローカルアプリにパスを送信
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST,
      { path: request.path },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Native messaging error:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, response: response });
        }
      }
    );
    // 非同期レスポンスのために true を返す
    return true;
  }
});
