const textToInsert =
  "Добрый день! Меня зовут Андрей, я из отдела контроля качества. Мы увидели ваш негативный отзыв на заказ нашего товара. Нам очень жаль, что вы столкнулись с этой ситуацией. Хотим исправить ваше впечатление и компенсировать потраченные средства.";

function insertTextAndSubmit() {
  const textarea = document.querySelector(
    'textarea.Text-area-input__field__1aRBaQge5s[id="messageInput"][name="messageInput"]'
  );

  if (textarea) {
    textarea.value = textToInsert;

    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });

    textarea.dispatchEvent(enterEvent);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "insert_text") {
    insertTextAndSubmit();
    sendResponse({ status: "done" });
    return true;
  }
});
