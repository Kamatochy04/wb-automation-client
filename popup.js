// popup.js

document.addEventListener("DOMContentLoaded", function () {
  const startButton = document.getElementById("startButton");
  const resetButton = document.getElementById("resetButton");

  const getCurrentTabId = () => {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.id);
      });
    });
  };

  // Отображение текущего индекса (для удобства)
  const updateIndexDisplay = () => {
    chrome.storage.local.get(["extension_current_index"], (result) => {
      const index = result["extension_current_index"] || 0;
      document.getElementById(
        "indexDisplay"
      ).textContent = `Текущий индекс: ${index}`;
    });
  };

  updateIndexDisplay();
  chrome.storage.onChanged.addListener(updateIndexDisplay);

  startButton.addEventListener("click", async () => {
    const activeTabId = await getCurrentTabId();
    if (!activeTabId) return;

    // Отправляем команду Service Worker'у для выполнения ОДНОГО шага
    chrome.runtime
      .sendMessage({
        action: "start_next_step",
        tabId: activeTabId,
      })
      .then(() => {
        console.log("[Popup] Команда на выполнение шага отправлена.");
      })
      .catch((error) => {
        console.error("[Popup] Ошибка при отправке команды:", error);
      });
  });

  resetButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "reset_index" });
  });
});
