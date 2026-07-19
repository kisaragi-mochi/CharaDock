// SPDX-License-Identifier: Apache-2.0
const header = document.querySelector(".site-header");
const characterButtons = [...document.querySelectorAll("[data-character-choice]")];
const copyButton = document.querySelector("#copyCommand");

const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

for (const button of characterButtons) {
  button.addEventListener("click", () => {
    const character = button.dataset.characterChoice || "amber";
    document.body.dataset.character = character;
    for (const candidate of characterButtons) {
      const selected = candidate === button;
      candidate.classList.toggle("is-active", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    }
  });
}

copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("npm ci\nnpm run desktop");
    copyButton.textContent = "コピー済み";
    window.setTimeout(() => { copyButton.textContent = "コピー"; }, 1600);
  } catch {
    copyButton.textContent = "選択してコピー";
  }
});

document.querySelector("#year").textContent = String(new Date().getFullYear());
