// SPDX-License-Identifier: Apache-2.0
const { ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/desktop/mascot-overlay.css";
  document.head.appendChild(stylesheet);
  const bubble = document.createElement("div");
  bubble.id = "desktopMascotBubble";
  bubble.setAttribute("role", "status");
  const bubbleText = document.createElement("span");
  bubbleText.id = "desktopMascotBubbleText";
  bubble.appendChild(bubbleText);
  document.body.appendChild(bubble);
  bubble.title = "クリックすると全文を展開します";
  bubble.addEventListener("click", () => bubble.classList.toggle("is-expanded"));

  const dock = document.createElement("div");
  dock.id = "desktopMascotDock";
  dock.innerHTML = `
    <span id="desktopMascotHint" role="status"></span>
    <form id="desktopMascotComposer">
      <button id="desktopMascotModeButton" type="button" aria-label="会話モードと作業モードを切り替える">会話</button>
      <button id="desktopMascotWorkTarget" type="button" aria-label="作業先フォルダーを変更する"></button>
      <button id="desktopMascotMicButton" type="button" aria-label="音声入力" aria-pressed="false">●</button>
      <textarea id="desktopMascotInput" rows="1" maxlength="1200" aria-label="メッセージ" placeholder="短く話しかける…"></textarea>
      <button id="desktopMascotSendButton" type="submit" aria-label="送信">↑</button>
    </form>
    <button id="desktopMascotSettingsButton" type="button" aria-label="設定を開く">⚙</button>
    <button id="desktopMascotChatButton" type="button" aria-label="会話入力を開く">✦</button>`;
  document.body.appendChild(dock);
  const petZone = document.createElement("div");
  petZone.id = "desktopMascotPetZone";
  petZone.setAttribute("aria-label", "キャラクターに触れる");
  petZone.title = "ドラッグで移動・クリックで触れる・ダブルクリックで話す";
  document.body.appendChild(petZone);
  const form = dock.querySelector("#desktopMascotComposer");
  const input = dock.querySelector("#desktopMascotInput");
  const sendButton = dock.querySelector("#desktopMascotSendButton");
  const micButton = dock.querySelector("#desktopMascotMicButton");
  const modeButton = dock.querySelector("#desktopMascotModeButton");
  const workTarget = dock.querySelector("#desktopMascotWorkTarget");
  const hint = dock.querySelector("#desktopMascotHint");
  let statusTimer;
  let autoCloseTimer;
  let sending = false;
  let speechRecognition;
  let appState;
  let realtimePeer = null;
  let realtimeDataChannel = null;
  let realtimeRemoteAudio = null;
  let realtimeStream;
  let lastStreamPulseAt = 0;

  const applyInteractionMode = (state = {}) => {
    const workMode = state.interactionMode === "work";
    document.body.classList.toggle("is-work-mode", workMode);
    modeButton.textContent = workMode ? "作業" : "会話";
    modeButton.setAttribute("aria-pressed", String(workMode));
    modeButton.title = workMode ? "会話モードへ戻す" : "作業モードへ切り替える";
    workTarget.textContent = `作業先 · ${state.workDirectoryName || "未選択"}`;
    input.placeholder = workMode ? "このフォルダーでやること…" : "短く話しかける…";
  };

  const applyCharacter = (character) => {
    const ui = character?.ui || {};
    const root = document.documentElement.style;
    const percent = (name, value, fallback) => root.setProperty(name, `${Number(value) || fallback}%`);
    percent("--mascot-bubble-left", ui.bubbleLeft, 18);
    percent("--mascot-bubble-top", ui.bubbleTop, 24);
    percent("--mascot-bubble-width", ui.bubbleWidth, 68);
    percent("--mascot-pet-left", ui.petLeft, 0);
    percent("--mascot-pet-top", ui.petTop, 27);
    percent("--mascot-pet-width", ui.petWidth, 56);
    percent("--mascot-pet-height", ui.petHeight, 42);
  };
  const applyWindowSettings = (settings = {}) => {
    document.body.classList.toggle("is-position-locked", Boolean(settings.positionLocked));
  };

  const setStatus = (message, duration = 2600) => {
    clearTimeout(statusTimer);
    hint.textContent = String(message || "");
    dock.classList.toggle("is-status", Boolean(hint.textContent));
    statusTimer = setTimeout(() => dock.classList.remove("is-status"), duration);
  };
  const setOpen = (open, { focus = false } = {}) => {
    clearTimeout(autoCloseTimer);
    dock.classList.toggle("is-open", Boolean(open));
    if (open && focus) setTimeout(() => input.focus(), 30);
  };
  const scheduleAutoClose = () => {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      if (!sending && document.activeElement !== input && !speechRecognition) setOpen(false);
    }, 720);
  };
  const showSpeech = (payload) => {
    clearTimeout(hideTimer);
    bubbleText.textContent = String(payload?.text || "");
    bubble.classList.remove("is-expanded");
    bubble.classList.toggle("is-visible", Boolean(bubbleText.textContent));
    hideTimer = setTimeout(() => bubble.classList.remove("is-visible"), Math.max(1500, Number(payload?.durationMs) || 9000));
    if (payload?.ttsEnabled && bubbleText.textContent && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(bubbleText.textContent);
      utterance.lang = String(payload.speechLanguage || "ja-JP");
      utterance.rate = 1.03;
      let pulse;
      utterance.onstart = () => { pulse = setInterval(() => ipcRenderer.invoke("mascotInline:voice", .2 + Math.random() * .28), 85); };
      const stop = () => { clearInterval(pulse); ipcRenderer.invoke("mascotInline:voice", 0); };
      utterance.onend = stop;
      utterance.onerror = stop;
      window.speechSynthesis.speak(utterance);
    }
  };

  const chatButton = dock.querySelector("#desktopMascotChatButton");
  chatButton.addEventListener("pointerenter", () => setOpen(true));
  chatButton.addEventListener("click", () => setOpen(true, { focus: true }));
  dock.addEventListener("pointerenter", () => clearTimeout(autoCloseTimer));
  dock.addEventListener("pointerleave", scheduleAutoClose);
  dock.querySelector("#desktopMascotSettingsButton").addEventListener("click", () => ipcRenderer.invoke("mascotInline:openControl"));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); input.blur(); setOpen(false); }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || sendButton.disabled) return;
    input.value = "";
    sending = true;
    sendButton.disabled = true;
    modeButton.disabled = true;
    workTarget.disabled = true;
    setStatus(appState?.interactionMode === "work" ? "作業を開始…" : "考え中…", 30_000);
    try {
      const result = await ipcRenderer.invoke("mascotInline:chat", message);
      showSpeech({ text: result.text, durationMs: 9000 });
      setStatus(result.mode === "work" ? `${result.workDirectoryName || "選択フォルダー"}で作業完了` : result.provider === "codex" ? "Codexから返答" : "OpenAIから返答");
    } catch (error) {
      showSpeech({ text: `エラー: ${error.message}`, durationMs: 12_000 });
      setStatus("送信できませんでした");
    } finally {
      sendButton.disabled = false;
      modeButton.disabled = false;
      workTarget.disabled = false;
      sending = false;
      input.focus();
    }
  });

  modeButton.addEventListener("click", async () => {
    try {
      const next = appState?.interactionMode === "work" ? "chat" : "work";
      appState = await ipcRenderer.invoke("mascotInline:setMode", next);
      applyInteractionMode(appState);
      setStatus(appState.interactionMode === "work" ? `作業先: ${appState.workDirectoryName}` : "会話モード");
      input.focus();
    } catch (error) {
      setStatus(error.message, 5000);
    }
  });
  workTarget.addEventListener("click", async () => {
    try {
      appState = await ipcRenderer.invoke("mascotInline:chooseWorkDirectory");
      applyInteractionMode(appState);
      setStatus(appState.workDirectoryName ? `作業先: ${appState.workDirectoryName}` : "作業先は変更されませんでした");
      input.focus();
    } catch (error) {
      setStatus(error.message, 5000);
    }
  });

  const stage = document.querySelector("#stage");
  let hoverSentAt = 0;
  const reportHover = (hovered) => {
    const now = performance.now();
    if (hovered && now - hoverSentAt < 180) return;
    hoverSentAt = now;
    ipcRenderer.invoke("mascotInline:hover", hovered).catch(() => {});
  };
  stage?.addEventListener("pointerenter", () => reportHover(true));
  stage?.addEventListener("pointermove", () => reportHover(true));
  stage?.addEventListener("pointerleave", () => reportHover(false));
  let petTimer;
  let petDrag = null;
  let suppressPetClickUntil = 0;
  const finishPetDrag = (event) => {
    if (!petDrag || petDrag.pointerId !== event.pointerId) return;
    const dragged = petDrag.dragged;
    petDrag = null;
    document.body.classList.remove("is-mascot-window-dragging");
    petZone.releasePointerCapture?.(event.pointerId);
    ipcRenderer.invoke("mascotInline:drag", "end").catch(() => {});
    if (dragged) suppressPetClickUntil = performance.now() + 350;
  };
  petZone.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    petDrag = {
      pointerId: event.pointerId,
      screenX: event.screenX,
      screenY: event.screenY,
      dragged: false,
    };
    petZone.setPointerCapture?.(event.pointerId);
    ipcRenderer.invoke("mascotInline:drag", "start").catch(() => {});
  });
  petZone.addEventListener("pointermove", (event) => {
    if (!petDrag || petDrag.pointerId !== event.pointerId) return;
    if (!petDrag.dragged && Math.hypot(event.screenX - petDrag.screenX, event.screenY - petDrag.screenY) < 5) return;
    petDrag.dragged = true;
    document.body.classList.add("is-mascot-window-dragging");
    ipcRenderer.invoke("mascotInline:drag", "move").catch(() => {});
  });
  petZone.addEventListener("pointerup", finishPetDrag);
  petZone.addEventListener("pointercancel", finishPetDrag);
  petZone.addEventListener("click", () => {
    if (performance.now() < suppressPetClickUntil) return;
    clearTimeout(petTimer);
    petTimer = setTimeout(() => ipcRenderer.invoke("mascotInline:pet").catch(() => {}), 210);
  });
  petZone.addEventListener("dblclick", () => {
    if (performance.now() < suppressPetClickUntil) return;
    clearTimeout(petTimer);
    setOpen(true, { focus: true });
  });
  const startFallbackRecognition = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus("音声入力は詳細画面で利用できます");
      ipcRenderer.invoke("mascotInline:openControl");
      return false;
    }
    if (speechRecognition) { speechRecognition.stop(); return true; }
    speechRecognition = new Recognition();
    speechRecognition.lang = "ja-JP";
    speechRecognition.interimResults = true;
    speechRecognition.onresult = (event) => {
      input.value = [...event.results].map((result) => result[0]?.transcript || "").join("");
    };
    speechRecognition.onend = () => { speechRecognition = null; micButton.setAttribute("aria-pressed", "false"); input.focus(); };
    speechRecognition.onerror = (event) => setStatus(`音声入力: ${event.error}`);
    speechRecognition.start();
    micButton.setAttribute("aria-pressed", "true");
    setStatus("話してください…", 30_000);
    return true;
  };

  const closeRealtime = () => {
    try { realtimeDataChannel?.close(); } catch {}
    try { realtimePeer?.close(); } catch {}
    realtimeRemoteAudio?.pause();
    if (realtimeRemoteAudio) realtimeRemoteAudio.srcObject = null;
    for (const track of realtimeStream?.getTracks?.() || []) track.stop();
    realtimePeer = null;
    realtimeDataChannel = null;
    realtimeRemoteAudio = null;
    realtimeStream = null;
    micButton.setAttribute("aria-pressed", "false");
  };

  const startRealtime = async () => {
    realtimeStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    realtimePeer = new RTCPeerConnection();
    for (const track of realtimeStream.getAudioTracks()) realtimePeer.addTrack(track, realtimeStream);
    realtimeRemoteAudio = new Audio();
    realtimeRemoteAudio.autoplay = true;
    realtimePeer.addEventListener("track", (event) => {
      realtimeRemoteAudio.srcObject = event.streams[0] || new MediaStream([event.track]);
      realtimeRemoteAudio.play().catch(() => {});
    });
    realtimeDataChannel = realtimePeer.createDataChannel("oai-events");
    realtimePeer.addEventListener("connectionstatechange", () => {
      if (["failed", "disconnected"].includes(realtimePeer?.connectionState)) {
        setStatus("Codex Realtime音声接続が切れました", 5000);
        closeRealtime();
      }
    });
    const offer = await realtimePeer.createOffer();
    await realtimePeer.setLocalDescription(offer);
    await ipcRenderer.invoke("mascotInline:realtimeStart", { sdp: realtimePeer.localDescription?.sdp || offer.sdp });
    micButton.setAttribute("aria-pressed", "true");
    setStatus("Codex Realtimeへ接続中…", 30_000);
  };

  micButton.addEventListener("click", async () => {
    if (realtimePeer) {
      await ipcRenderer.invoke("mascotInline:realtimeStop").catch(() => {});
      closeRealtime();
      setStatus("音声入力を終了しました");
      return;
    }
    appState = await ipcRenderer.invoke("mascotInline:getState").catch(() => appState);
    if (appState?.backend === "codex") {
      try {
        await startRealtime();
        return;
      } catch (error) {
        ipcRenderer.invoke("mascotInline:realtimeStop").catch(() => {});
        closeRealtime();
        setStatus(`端末音声認識へ切替: ${error.message}`, 5000);
      }
    }
    startFallbackRecognition();
  });

  let hideTimer;
  ipcRenderer.on("mascot:speech", (_event, payload) => {
    showSpeech(payload);
  });
  ipcRenderer.on("mascot:stream", (_event, payload) => {
    if (payload?.phase === "start") {
      clearTimeout(hideTimer);
      bubbleText.textContent = "考え中…";
      bubble.classList.add("is-visible");
      return;
    }
    if (payload?.phase === "delta") {
      bubbleText.textContent = String(payload.text || "");
      bubble.classList.add("is-visible");
      const now = performance.now();
      if (now - lastStreamPulseAt > 90) {
        lastStreamPulseAt = now;
        ipcRenderer.invoke("mascotInline:voice", .16 + Math.random() * .2).catch(() => {});
      }
      return;
    }
    if (payload?.phase === "activity") {
      setStatus(String(payload.text || "作業中…"), 30_000);
      return;
    }
    ipcRenderer.invoke("mascotInline:voice", 0).catch(() => {});
  });
  ipcRenderer.on("mascot:realtimeEvent", async (_event, message) => {
    const method = String(message?.method || "");
    const params = message?.params || {};
    if (method === "thread/realtime/sdp") {
      if (realtimePeer && params.sdp) {
        await realtimePeer.setRemoteDescription({ type: "answer", sdp: String(params.sdp) });
      }
      return;
    }
    if (method === "thread/realtime/started") {
      setStatus("話してください…もう一度押すと終了", 30_000);
      return;
    }
    if (method === "thread/realtime/transcript/delta" && params.role === "user") {
      input.value += String(params.delta || "");
      return;
    }
    if (method === "thread/realtime/transcript/done" && params.role === "user") {
      input.value = "";
      setStatus("Codexが考えています…", 30_000);
      return;
    }
    if (method === "thread/realtime/error") {
      setStatus(`Codex Realtime: ${params.message || "接続エラー"}`, 5000);
      closeRealtime();
      return;
    }
    if (method === "thread/realtime/closed") closeRealtime();
  });
  ipcRenderer.on("mascot:toggleChat", (_event, payload) => setOpen(
    payload?.open ?? !dock.classList.contains("is-open"),
    { focus: Boolean(payload?.focus) },
  ));
  ipcRenderer.on("mascot:character", (_event, character) => applyCharacter(character));
  ipcRenderer.on("mascot:windowSettings", (_event, settings) => applyWindowSettings(settings));
  ipcRenderer.on("mascot:mode", (_event, state) => {
    appState = { ...appState, ...state };
    applyInteractionMode(appState);
  });
  ipcRenderer.on("mascot:tts", (_event, payload) => {
    if (!payload?.enabled) {
      window.speechSynthesis?.cancel();
      ipcRenderer.invoke("mascotInline:voice", 0).catch(() => {});
    }
  });
  ipcRenderer.invoke("mascotInline:getState").then((state) => {
    appState = state;
    applyInteractionMode(state);
    applyCharacter(state.characters?.find((character) => character.id === state.characterId));
    applyWindowSettings(state);
  }).catch(() => {});
});
