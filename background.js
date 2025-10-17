const HIGHLIGHT_CLASS = "extension-highlight-target";
const STORAGE_KEY_INDEX = "extension_current_index";
const CONTAINER_SELECTOR = "div.Buttons-cell__bN0zcomOrU";
const PROCESSING_DELAY_MS = 2000;
const NAVIGATE_SELECTOR = ".Token-pagination__arrows-wrapper__InlDNF0svQ";
const TEXT_TO_INSERT = `
Добрый день!

Меня зовут Андрей, я из отдела контроля качества. Мы увидели ваш негативный отзыв на заказ нашего товара. Нам очень жаль, что вы столкнулись с этой ситуацией.

Хотим исправить ваше впечатление и компенсировать потраченные средства.`;
const TEXTAREA_SELECTOR =
  'textarea.Text-area-input__field__1aRBaQge5s[id="messageInput"][name="messageInput"]';

const TIMER_INTERVAL_MINUTES = 0.166666; // 10 секунд
const TIMER_NAME = "tenSecondTimer";
const STORAGE_KEY_TAB_ID = "extension_target_tab_id";

let isProcessing = false;

async function clickButtonByIndex() {
  const highlightClass = arguments[0];
  const containerSelector = arguments[1];
  const targetIndex = arguments[2];

  const statusElements = document.querySelectorAll(".Status-cell__mleni4JnZe");
  console.log("Все элементы статуса:", Array.from(statusElements));

  let allContainers = Array.from(document.querySelectorAll(containerSelector));

  console.log("Текущий элемент статуса:", statusElements[targetIndex]);

  document.querySelectorAll(`.${highlightClass}`).forEach((el) => {
    el.style.border = "";
    el.classList.remove(highlightClass);
  });

  // for (let i = 0; i < 5; i++) {
  //   await new Promise((resolve) => setTimeout(resolve, 1000));
  //   console.log(statusElements);
  // }

  if (targetIndex >= 0 && targetIndex < allContainers.length) {
    const targetElement = allContainers[targetIndex];
    const statusElement = statusElements[targetIndex];

    // 2. ПРОВЕРКА СТАТУСА: Если элемент статуса существует
    if (statusElement) {
      const chipTextElement = statusElement.querySelector(
        ".Chips__text__Agf4iPgm-r"
      );

      if (chipTextElement) {
        const statusText = chipTextElement.textContent.trim();
        const skipStatuses = ["Снят с публикации", "Жалоба одобрена"];

        if (skipStatuses.includes(statusText)) {
          console.warn(
            `[Content] Статус "${statusText}" найден. Пропускаем индекс ${targetIndex}.`
          );
          // Возвращаем статус 'skipped'
          return { status: "skipped", totalElements: allContainers.length };
        }
      }
    }

    if (targetElement) {
      const firstButton = targetElement.querySelector("button");

      if (firstButton) {
        targetElement.style.border = "2px solid red";
        targetElement.classList.add(highlightClass);
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });

        firstButton.click();
        return { status: "clicked", totalElements: allContainers.length };
      } else {
        console.warn(`Кнопка не найдена в элементе ${targetIndex}. Пропуск.`);
        return { status: "skipped", totalElements: allContainers.length };
      }
    }
  }

  return { status: "index_out_of_bounds", totalElements: allContainers.length };
}

async function insertTextWaitAndClose() {
  const text = arguments[0];
  const delayBeforeCloseMs = arguments[1];
  const selector = arguments[2];
  const timeout = 10000;
  const start = Date.now();

  const waitForTextarea = (selector) => {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const textarea = document.querySelector(selector);
        if (textarea) {
          clearInterval(interval);
          resolve(textarea);
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
    });
  };

  const textarea = await waitForTextarea(selector);

  if (textarea) {
    textarea.value = text;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 500));

    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(enterEvent);
  } else {
    console.warn("Textarea не найдена за отведённое время.");
  }

  await new Promise((resolve) => setTimeout(resolve, delayBeforeCloseMs));
  window.close();
  await new Promise((resolve) => setTimeout(resolve, 50));

  return { status: "tab_closed_by_script" };
}

async function waitForTabToLoad(tabId) {
  try {
    let tab = await chrome.tabs.get(tabId);
    let attempts = 0;
    const MAX_WAIT = 20;

    while (tab && tab.status !== "complete" && attempts < MAX_WAIT) {
      await new Promise((r) => setTimeout(r, 200));
      tab = await chrome.tabs.get(tabId);
      attempts++;
    }
    return tab?.status === "complete";
  } catch {
    return false;
  }
}

async function runSingleStep(originalTabId) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const TAB_SEARCH_DELAY_MS = 500;
    const isTabReady = await waitForTabToLoad(originalTabId);
    if (!isTabReady) {
      console.warn(`[Background] Вкладка ${originalTabId} не готова.`);
      isProcessing = false;
      return;
    }

    const result = await chrome.storage.local.get([STORAGE_KEY_INDEX]);
    let currentIndex = result[STORAGE_KEY_INDEX] || 0;
    console.log(`\n--- [Background] Шаг, индекс: ${currentIndex} ---`);

    const tabsBeforeClick = await chrome.tabs.query({});
    let clickData = null; // безопасное выполнение clickButtonByIndex
    try {
      const clickResults = await chrome.scripting.executeScript({
        target: { tabId: originalTabId },
        func: clickButtonByIndex,
        args: [HIGHLIGHT_CLASS, CONTAINER_SELECTOR, currentIndex],
      });
      clickData = clickResults[0]?.result;
    } catch (e) {
      if (e.message?.includes("Frame with ID 0 was removed")) {
        console.warn(
          "[Background] Frame перезагрузился. Повтор через 1 сек..."
        );
        isProcessing = false;
        return setTimeout(() => runSingleStep(originalTabId), 1000);
      } else {
        console.error("[Background] Ошибка clickButtonByIndex:", e);
        isProcessing = false;
        return;
      }
    }

    const status = clickData?.status;
    const totalElements = clickData?.totalElements || 0;

    if (status === "index_out_of_bounds" || currentIndex >= totalElements) {
      console.log(
        "[Background] Все элементы обработаны. Цикл завершается, таймер останавливается."
      );
      await chrome.storage.local.set({ [STORAGE_KEY_INDEX]: 0 });
      await chrome.alarms.clear(TIMER_NAME);
      await chrome.storage.local.remove(STORAGE_KEY_TAB_ID);
      isProcessing = false;
      return;
    } // Пропуск (включая пропуск по статусу)

    if (status === "skipped") {
      console.log("[Background] Пропущено. Следующий элемент.");
      await chrome.storage.local.set({ [STORAGE_KEY_INDEX]: currentIndex + 1 });
      // Немедленный запуск следующего шага, чтобы не ждать 10 секунд
      isProcessing = false;
      return setTimeout(() => runSingleStep(originalTabId), 1000);
    } // Обработка клика

    if (status === "clicked") {
      let newTab = null;
      for (let i = 0; i < 10 && !newTab; i++) {
        await new Promise((r) => setTimeout(r, TAB_SEARCH_DELAY_MS));
        const tabsAfterClick = await chrome.tabs.query({});
        newTab = tabsAfterClick.find(
          (tab) =>
            !tabsBeforeClick.some((oldTab) => oldTab.id === tab.id) &&
            tab.openerTabId === originalTabId
        );
      }

      if (newTab) {
        console.log(`[Background] Новая вкладка: ${newTab.id}`);

        try {
          await chrome.scripting.executeScript({
            target: { tabId: newTab.id },
            func: insertTextWaitAndClose,
            args: [TEXT_TO_INSERT, PROCESSING_DELAY_MS, TEXTAREA_SELECTOR],
          });
        } catch (e) {
          console.warn("[Background] Ошибка при вставке текста:", e);
        } // ждём закрытия

        let stillOpen = true;
        for (let i = 0; i < 15 && stillOpen; i++) {
          await new Promise((r) => setTimeout(r, 200));
          try {
            await chrome.tabs.get(newTab.id);
          } catch {
            stillOpen = false;
          }
        }

        if (stillOpen) await chrome.tabs.remove(newTab.id).catch(() => {});
        console.log("[Background] Вкладка закрыта, возвращаемся.");
      } else {
        console.warn("[Background] Новая вкладка не найдена.");
      }

      await chrome.storage.local.set({ [STORAGE_KEY_INDEX]: currentIndex + 1 });
      console.log(`[Background] Следующий индекс: ${currentIndex + 1}`);
      // Если клик был успешным, следующий шаг запустит таймер
    }
  } catch (err) {
    console.error("[Background] Ошибка в runSingleStep:", err);
  } finally {
    isProcessing = false;
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== TIMER_NAME) return;

  const result = await chrome.storage.local.get([STORAGE_KEY_TAB_ID]);
  const targetTabId = result[STORAGE_KEY_TAB_ID];
  if (!targetTabId) {
    console.warn("[Background] Нет активной вкладки. Останавливаем таймер.");
    chrome.alarms.clear(TIMER_NAME);
    return;
  }

  try {
    await chrome.tabs.get(targetTabId);
    runSingleStep(targetTabId);
  } catch {
    console.error("[Background] Вкладка не найдена. Остановка таймера.");
    chrome.alarms.clear(TIMER_NAME);
    chrome.storage.local.remove(STORAGE_KEY_TAB_ID);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_next_step" && request.tabId) {
    chrome.storage.local.set({ [STORAGE_KEY_TAB_ID]: request.tabId });

    chrome.alarms.create(TIMER_NAME, {
      periodInMinutes: TIMER_INTERVAL_MINUTES,
    });

    console.log(`[Background] Цикл запущен для вкладки ID: ${request.tabId}`);
    runSingleStep(request.tabId);

    sendResponse({ status: "started" });
    return true;
  }

  if (request.action === "reset_index") {
    chrome.alarms.clear(TIMER_NAME);
    chrome.storage.local.remove(STORAGE_KEY_TAB_ID);
    chrome.storage.local.set({ [STORAGE_KEY_INDEX]: 0 }).then(() => {
      console.log("[Background] Индекс сброшен и таймер остановлен.");
      sendResponse({ status: "index_reset" });
    });
    return true;
  }
});
