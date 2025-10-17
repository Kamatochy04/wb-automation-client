let id = 0;

(async () => {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const selector = ".Buttons-cell__bN0zcomOrU";

  const tableRows = document.querySelectorAll(selector);

  if (tableRows.length === 0) {
    console.warn("[Content Script] Элементы для клика не найдены.");
    return;
  }

  if (id < tableRows.length) {
    const buttonContainer = tableRows[id].firstElementChild;
    const button = buttonContainer
      ? buttonContainer.querySelector("button")
      : null;

    if (button) {
      console.log(`[Content Script] Кликаем по элементу №${i}`);
      button.click();
    } else {
      console.warn(`[Content Script] Кнопка не найдена в строке №${i}.`);
    }

    await delay(14000);
    id++;
  }

  console.log("[Content Script] Цикл завершен.");
})();
