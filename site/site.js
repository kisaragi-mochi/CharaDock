// SPDX-License-Identifier: Apache-2.0
const header = document.querySelector(".site-header");
const characterButtons = [...document.querySelectorAll("[data-character-choice]")];
const copyButton = document.querySelector("#copyCommand");
const languageLinks = [...document.querySelectorAll(".language-switch a[lang]")];
const languagePreferenceKey = "purupet-site-language";

try {
  const preferredLanguage = window.localStorage.getItem(languagePreferenceKey);
  if (document.documentElement.lang === "en" && preferredLanguage === "ja") {
    window.location.replace("./ja.html");
  }
} catch {
  // The language links continue to work when storage is unavailable.
}

for (const link of languageLinks) {
  link.addEventListener("pointerdown", () => {
    try {
      window.localStorage.setItem(languagePreferenceKey, link.lang === "ja" ? "ja" : "en");
    } catch {
      // Navigation itself does not depend on storage.
    }
  });
}

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
  const copyLabel = copyButton.dataset.labelCopy || "Copy";
  const copiedLabel = copyButton.dataset.labelCopied || "Copied";
  const selectLabel = copyButton.dataset.labelSelect || "Select and copy";
  try {
    await navigator.clipboard.writeText("npm ci\nnpm run desktop");
    copyButton.textContent = copiedLabel;
    window.setTimeout(() => { copyButton.textContent = copyLabel; }, 1600);
  } catch {
    copyButton.textContent = selectLabel;
  }
});

document.querySelector("#year").textContent = String(new Date().getFullYear());
