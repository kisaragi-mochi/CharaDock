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
  const workActivity = document.createElement("span");
  workActivity.id = "desktopMascotWorkActivity";
  const permissionActions = document.createElement("div");
  permissionActions.id = "desktopMascotPermissionActions";
  permissionActions.hidden = true;
  permissionActions.innerHTML = `
    <button type="button" data-permission-action="approve">今回だけ許可</button>
    <button type="button" data-permission-action="deny">やめる</button>`;
  const bubbleMore = document.createElement("button");
  bubbleMore.id = "desktopMascotBubbleMore";
  bubbleMore.type = "button";
  bubbleMore.hidden = true;
  bubbleMore.textContent = "全文";
  bubbleMore.setAttribute("aria-expanded", "false");
  bubble.append(bubbleText, workActivity, permissionActions, bubbleMore);
  document.body.appendChild(bubble);

  const dock = document.createElement("div");
  dock.id = "desktopMascotDock";
  dock.innerHTML = `
    <span id="desktopMascotHint" role="status"></span>
    <form id="desktopMascotComposer">
      <button id="desktopMascotModeButton" type="button" aria-label="会話モードと作業モードを切り替える">会話</button>
      <button id="desktopMascotWorkTarget" type="button" aria-label="作業先フォルダーを変更する"></button>
      <button id="desktopMascotWorkHistoryButton" type="button" aria-label="作業履歴を開く" aria-expanded="false">履歴</button>
      <button id="desktopMascotMicButton" type="button" aria-label="音声入力" aria-pressed="false">●</button>
      <textarea id="desktopMascotInput" rows="1" maxlength="6000" aria-label="メッセージ" placeholder="短く話しかける…"></textarea>
      <button id="desktopMascotSendButton" type="submit" aria-label="送信">↑</button>
    </form>
    <button id="desktopMascotSettingsButton" type="button" aria-label="設定を開く">⚙</button>
    <button id="desktopMascotChatButton" type="button" aria-label="会話入力を開く">✦</button>`;
  document.body.appendChild(dock);
  const workPanel = document.createElement("section");
  workPanel.id = "desktopMascotWorkPanel";
  workPanel.setAttribute("role", "dialog");
  workPanel.setAttribute("aria-label", "作業履歴");
  workPanel.setAttribute("aria-modal", "false");
  workPanel.setAttribute("aria-hidden", "true");
  workPanel.innerHTML = `
    <header>
      <div><strong>作業履歴</strong><span id="desktopMascotWorkPanelSummary">実行内容と結果</span></div>
      <button id="desktopMascotWorkPanelClose" type="button" aria-label="作業履歴を閉じる">×</button>
    </header>
    <div id="desktopMascotWorkHistoryList"></div>`;
  document.body.appendChild(workPanel);
  const petZone = document.createElement("div");
  petZone.id = "desktopMascotPetZone";
  petZone.setAttribute("aria-label", "キャラクターに触れる");
  petZone.title = "ドラッグで移動・クリックで触れる";
  document.body.appendChild(petZone);
  const form = dock.querySelector("#desktopMascotComposer");
  const input = dock.querySelector("#desktopMascotInput");
  const sendButton = dock.querySelector("#desktopMascotSendButton");
  const micButton = dock.querySelector("#desktopMascotMicButton");
  const modeButton = dock.querySelector("#desktopMascotModeButton");
  const workTarget = dock.querySelector("#desktopMascotWorkTarget");
  const workHistoryButton = dock.querySelector("#desktopMascotWorkHistoryButton");
  const workHistoryList = workPanel.querySelector("#desktopMascotWorkHistoryList");
  const workPanelSummary = workPanel.querySelector("#desktopMascotWorkPanelSummary");
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
  let recordedSpeechStream;
  let recordedSpeechRecorder;
  let recordedSpeechChunks = [];
  let recordedSpeechProvider = "openai";
  let realtimeUnavailable = false;
  let lastStreamPulseAt = 0;
  let workActivityTimer;
  let streamWorkMode = false;
  let streamHasActivity = false;
  let hideTimer;
  let bubbleHideDuration = 9000;
  let workHistoryState = { activeWorkRunId: null, runs: [] };
  let workPanelCloseTimer;
  let permissionTimer;
  let ttsAudio = null;
  let ttsPlaybackToken = 0;
  let ttsPulse = null;
  let thinkingFillerActive = false;

  const formatWorkTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "" : date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  };
  const workStatusLabel = (status) => ({
    running: "作業中", stopping: "中断中", completed: "完了", interrupted: "中断", failed: "エラー",
  }[status] || status);
  const setWorkPanelOpen = (open) => {
    clearTimeout(workPanelCloseTimer);
    workPanel.classList.toggle("is-open", Boolean(open));
    document.body.classList.toggle("is-work-panel-open", Boolean(open));
    workPanel.setAttribute("aria-hidden", String(!open));
    workHistoryButton.setAttribute("aria-expanded", String(Boolean(open)));
    if (open) workPanelCloseTimer = setTimeout(() => setWorkPanelOpen(false), 18_000);
  };
  const scheduleWorkPanelClose = (duration = 900) => {
    clearTimeout(workPanelCloseTimer);
    workPanelCloseTimer = setTimeout(() => setWorkPanelOpen(false), duration);
  };
  const renderWorkHistory = (payload = workHistoryState) => {
    workHistoryState = payload && Array.isArray(payload.runs) ? payload : { activeWorkRunId: null, runs: [] };
    workHistoryList.replaceChildren();
    workPanelSummary.textContent = workHistoryState.activeWorkRunId ? "作業を実行しています" : `${workHistoryState.runs.length}件を保持`;
    workHistoryButton.classList.toggle("has-active-work", Boolean(workHistoryState.activeWorkRunId));
    if (!workHistoryState.runs.length) {
      const empty = document.createElement("p");
      empty.className = "desktop-mascot-work-empty";
      empty.textContent = "まだ作業履歴はありません";
      workHistoryList.appendChild(empty);
      return;
    }
    for (const run of workHistoryState.runs) {
      const item = document.createElement("article");
      item.className = `desktop-mascot-work-run is-${run.status}`;
      const head = document.createElement("div");
      head.className = "desktop-mascot-work-run-head";
      const status = document.createElement("span");
      status.className = "desktop-mascot-work-status";
      status.textContent = workStatusLabel(run.status);
      const meta = document.createElement("span");
      meta.className = "desktop-mascot-work-meta";
      meta.textContent = [formatWorkTime(run.startedAt), run.workDirectoryName, run.characterName].filter(Boolean).join(" · ");
      head.append(status, meta);
      const request = document.createElement("p");
      request.className = "desktop-mascot-work-request";
      request.textContent = run.request || "作業内容なし";
      item.append(head, request);
      if (Array.isArray(run.activities) && run.activities.length) {
        const activities = document.createElement("ul");
        activities.className = "desktop-mascot-work-activities";
        for (const activity of run.activities) {
          const row = document.createElement("li");
          row.textContent = activity;
          activities.appendChild(row);
        }
        item.appendChild(activities);
      }
      if (run.result) {
        const result = document.createElement("p");
        result.className = "desktop-mascot-work-result";
        result.textContent = run.result;
        item.appendChild(result);
      }
      if (["running", "stopping"].includes(run.status) && run.id === workHistoryState.activeWorkRunId) {
        const stop = document.createElement("button");
        stop.type = "button";
        stop.className = "desktop-mascot-work-stop";
        stop.disabled = run.status === "stopping";
        stop.textContent = run.status === "stopping" ? "中断しています…" : "中断";
        stop.addEventListener("click", async () => {
          stop.disabled = true;
          stop.textContent = "中断しています…";
          try {
            renderWorkHistory(await ipcRenderer.invoke("mascotInline:interruptWork"));
          } catch (error) {
            setStatus(error.message, 5000);
            stop.disabled = false;
            stop.textContent = "中断";
          }
        });
        item.appendChild(stop);
      }
      workHistoryList.appendChild(item);
    }
  };

  const resizeInput = () => {
    const maxHeight = document.body.classList.contains("is-work-mode") ? 78 : 68;
    input.style.height = "0px";
    const height = Math.max(document.body.classList.contains("is-work-mode") ? 42 : 34, Math.min(maxHeight, input.scrollHeight));
    input.style.height = `${height}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const applyInteractionMode = (state = {}) => {
    const workMode = state.interactionMode === "work";
    document.body.classList.toggle("is-work-mode", workMode);
    modeButton.textContent = workMode ? "作業" : "会話";
    modeButton.setAttribute("aria-pressed", String(workMode));
    modeButton.title = workMode ? "会話モードへ戻す" : "作業モードへ切り替える";
    workTarget.textContent = `作業先 · ${state.workDirectoryName || "未選択"}`;
    workTarget.title = workTarget.textContent;
    input.placeholder = workMode ? "このフォルダーでやること…" : "短く話しかける…";
    if (!workMode) setWorkPanelOpen(false);
    resizeInput();
  };

  const applyCharacter = (character) => {
    document.documentElement.dataset.character = character?.id || "amber-avatar";
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
  const setWorkActivity = (message, { finish = false } = {}) => {
    clearTimeout(workActivityTimer);
    workActivity.textContent = String(message || "");
    bubble.classList.toggle("is-working", Boolean(workActivity.textContent));
    if (finish) workActivityTimer = setTimeout(() => bubble.classList.remove("is-working"), 2200);
  };
  const setOpen = (open, { focus = false } = {}) => {
    clearTimeout(autoCloseTimer);
    dock.classList.toggle("is-open", Boolean(open));
    if (open && focus) input.focus({ preventScroll: true });
  };
  const scheduleBubbleHide = (duration = bubbleHideDuration) => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      bubble.classList.remove("is-visible", "is-expanded");
      bubbleMore.setAttribute("aria-expanded", "false");
      bubbleMore.textContent = "全文";
    }, Math.max(1500, Number(duration) || 9000));
  };
  const clearPermission = () => {
    clearTimeout(permissionTimer);
    permissionActions.hidden = true;
    permissionActions.dataset.requestId = "";
    permissionActions.dataset.permissionType = "";
    bubble.classList.remove("is-permission");
  };
  const showPermission = (result) => {
    clearTimeout(hideTimer);
    const permissionType = String(result?.permissionRequest?.type || "");
    bubbleText.textContent = String(result?.text || "今回だけ許可してもいい？");
    permissionActions.dataset.requestId = String(result?.permissionRequest?.id || "");
    permissionActions.dataset.permissionType = permissionType;
    permissionActions.querySelector('[data-permission-action="approve"]').textContent = permissionType === "screen" ? "今回だけ見る" : "今回だけ開く";
    permissionActions.hidden = false;
    bubble.classList.remove("is-expanded", "has-overflow");
    bubble.classList.add("is-visible", "is-permission");
    bubbleMore.hidden = true;
    permissionTimer = setTimeout(() => {
      clearPermission();
      scheduleBubbleHide(1800);
    }, Math.max(10_000, Number(result?.permissionRequest?.expiresInMs) || 60_000));
  };
  const syncBubbleOverflow = () => {
    const measure = () => {
      let overflow = bubbleText.scrollHeight > bubbleText.clientHeight + 2;
      const conservativelyLong = bubbleText.textContent.length > 120 || bubbleText.textContent.split("\n").length > 4;
      if (!overflow && conservativelyLong) {
        const probe = bubbleText.cloneNode(true);
        Object.assign(probe.style, {
          position: "fixed",
          left: "-10000px",
          top: "0",
          display: "block",
          width: `${bubbleText.clientWidth}px`,
          maxHeight: "none",
          overflow: "visible",
          WebkitLineClamp: "unset",
          visibility: "hidden",
        });
        document.body.appendChild(probe);
        overflow = probe.scrollHeight > bubbleText.clientHeight + 2;
        probe.remove();
      }
      overflow ||= conservativelyLong;
      bubble.classList.toggle("has-overflow", overflow);
      bubbleMore.hidden = !overflow;
    };
    measure();
    requestAnimationFrame(measure);
  };
  bubbleMore.addEventListener("click", () => {
    const expanded = !bubble.classList.contains("is-expanded");
    bubble.classList.toggle("is-expanded", expanded);
    bubbleMore.setAttribute("aria-expanded", String(expanded));
    bubbleMore.textContent = expanded ? "閉じる" : "全文";
    if (expanded) clearTimeout(hideTimer);
    else scheduleBubbleHide(Math.max(9000, bubbleHideDuration));
  });
  const scheduleAutoClose = () => {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      if (!sending && document.activeElement !== input && !speechRecognition) setOpen(false);
    }, 720);
  };
  const stopTtsPlayback = () => {
    ttsPlaybackToken += 1;
    window.speechSynthesis?.cancel();
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.src = "";
      ttsAudio = null;
    }
    clearInterval(ttsPulse);
    ttsPulse = null;
    ipcRenderer.invoke("mascotInline:voice", 0).catch(() => {});
  };
  const startTtsPulse = () => {
    clearInterval(ttsPulse);
    ttsPulse = setInterval(() => ipcRenderer.invoke("mascotInline:voice", .2 + Math.random() * .28).catch(() => {}), 85);
  };
  const playStyleBertSpeech = async (text) => {
    const token = ttsPlaybackToken;
    try {
      const result = await ipcRenderer.invoke("mascotInline:synthesizeTts", text);
      for (const source of result?.audioDataUrls || []) {
        if (token !== ttsPlaybackToken) return;
        await new Promise((resolve, reject) => {
          ttsAudio = new Audio(source);
          ttsAudio.preload = "auto";
          ttsAudio.onplay = startTtsPulse;
          ttsAudio.onended = resolve;
          ttsAudio.onerror = () => {
            const detail = ({ 1: "再生が中断されました", 2: "音声データを読み込めません", 3: "音声形式をデコードできません", 4: "音声形式に対応していません" })[ttsAudio.error?.code];
            reject(new Error(`生成した音声を再生できません${detail ? `（${detail}）` : ""}。`));
          };
          ttsAudio.play().catch(reject);
        });
      }
    } catch (error) {
      if (token === ttsPlaybackToken) setStatus(error.message, 5000);
    } finally {
      if (token === ttsPlaybackToken) {
        clearInterval(ttsPulse);
        ttsPulse = null;
        ttsAudio = null;
        ipcRenderer.invoke("mascotInline:voice", 0).catch(() => {});
      }
    }
  };
  const speakSystemText = (text, language) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = String(language || "ja-JP");
    utterance.rate = 1.03;
    utterance.onstart = startTtsPulse;
    const stop = () => { clearInterval(ttsPulse); ttsPulse = null; ipcRenderer.invoke("mascotInline:voice", 0); };
    utterance.onend = stop;
    utterance.onerror = stop;
    window.speechSynthesis.speak(utterance);
  };
  const showSpeech = (payload) => {
    clearPermission();
    clearTimeout(hideTimer);
    bubbleText.textContent = String(payload?.text || "");
    bubble.classList.remove("is-expanded", "has-overflow");
    bubbleMore.hidden = true;
    bubbleMore.textContent = "全文";
    bubbleMore.setAttribute("aria-expanded", "false");
    bubble.classList.toggle("is-visible", Boolean(bubbleText.textContent));
    bubbleHideDuration = Math.max(1500, Number(payload?.durationMs) || 9000);
    syncBubbleOverflow();
    scheduleBubbleHide(bubbleHideDuration);
    stopTtsPlayback();
    thinkingFillerActive = false;
    if (payload?.ttsEnabled && bubbleText.textContent && payload?.ttsProvider === "style-bert-vits2") {
      playStyleBertSpeech(bubbleText.textContent);
    } else if (payload?.ttsEnabled && bubbleText.textContent && window.speechSynthesis) {
      speakSystemText(bubbleText.textContent, payload.speechLanguage);
    }
  };

  const chatButton = dock.querySelector("#desktopMascotChatButton");
  chatButton.addEventListener("pointerenter", () => setOpen(true));
  chatButton.addEventListener("click", () => setOpen(true, { focus: true }));
  dock.addEventListener("pointerenter", () => clearTimeout(autoCloseTimer));
  dock.addEventListener("pointerleave", scheduleAutoClose);
  dock.querySelector("#desktopMascotSettingsButton").addEventListener("click", () => ipcRenderer.invoke("mascotInline:openControl"));
  workHistoryButton.addEventListener("click", async () => {
    const open = !workPanel.classList.contains("is-open");
    setWorkPanelOpen(open);
    if (open) renderWorkHistory(await ipcRenderer.invoke("mascotInline:getWorkHistory").catch(() => workHistoryState));
  });
  workPanel.querySelector("#desktopMascotWorkPanelClose").addEventListener("click", () => setWorkPanelOpen(false));
  workPanel.addEventListener("pointerenter", () => clearTimeout(workPanelCloseTimer));
  workPanel.addEventListener("pointerleave", () => scheduleWorkPanelClose());
  document.addEventListener("pointerdown", (event) => {
    if (workPanel.classList.contains("is-open") && !workPanel.contains(event.target) && !workHistoryButton.contains(event.target)) {
      setWorkPanelOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && workPanel.classList.contains("is-open")) setWorkPanelOpen(false);
  });
  permissionActions.addEventListener("click", async (event) => {
    const action = event.target.closest("button")?.dataset?.permissionAction;
    const requestId = permissionActions.dataset.requestId;
    const permissionType = permissionActions.dataset.permissionType;
    if (!action || !requestId || !["screen", "browser"].includes(permissionType) || sending) return;
    const isScreen = permissionType === "screen";
    sending = true;
    sendButton.disabled = true;
    modeButton.disabled = true;
    workTarget.disabled = true;
    setStatus(action === "approve" ? isScreen ? "画面を1枚だけ取得しています…" : "読み取りブラウザを準備しています…" : "許可を取り消しています…", 30_000);
    try {
      const channel = action === "approve"
        ? isScreen ? "mascotInline:approveScreenShare" : "mascotInline:approveBrowserUse"
        : isScreen ? "mascotInline:declineScreenShare" : "mascotInline:declineBrowserUse";
      const result = await ipcRenderer.invoke(
        channel,
        requestId,
      );
      clearPermission();
      showSpeech({ text: result.text, durationMs: 9000 });
      setStatus(action === "approve" ? isScreen ? "画面を確認しました" : "ブラウザ確認が完了しました" : isScreen ? "画面は共有されませんでした" : "ブラウザは開かれませんでした");
    } catch (error) {
      clearPermission();
      showSpeech({ text: `エラー: ${error.message}`, durationMs: 12_000 });
      setStatus(isScreen ? "画面を共有できませんでした" : "ブラウザを利用できませんでした");
    } finally {
      sendButton.disabled = false;
      modeButton.disabled = false;
      workTarget.disabled = false;
      sending = false;
      input.focus();
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); input.blur(); setOpen(false); }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
  });
  input.addEventListener("input", resizeInput);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || sendButton.disabled) return;
    input.value = "";
    resizeInput();
    sending = true;
    sendButton.disabled = true;
    modeButton.disabled = true;
    workTarget.disabled = true;
    setStatus(appState?.interactionMode === "work" ? "作業を開始…" : "考え中…", 30_000);
    try {
      const result = await ipcRenderer.invoke("mascotInline:chat", message);
      if (["screen", "browser"].includes(result.permissionRequest?.type)) {
        showPermission(result);
        setStatus("会話で「いいよ」と答えても許可できます", 6000);
      } else {
        showSpeech({ text: result.text, durationMs: 9000 });
        setStatus(result.permissionDeclined ? result.permissionType === "browser" ? "ブラウザは開かれませんでした" : "画面は共有されませんでした" : result.mode === "work" ? `${result.workDirectoryName || "選択フォルダー"}で作業完了` : result.provider === "codex" ? "Codexから返答" : "OpenAIから返答");
      }
    } catch (error) {
      const interrupted = appState?.interactionMode === "work" && /interrupt|cancel|中断/i.test(String(error.message || ""));
      showSpeech({ text: interrupted ? "作業を中断しました。履歴から内容を確認できます。" : `エラー: ${error.message}`, durationMs: 12_000 });
      setStatus(interrupted ? "作業を中断しました" : "送信できませんでした");
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
  let petDrag = null;
  let suppressPetClickUntil = 0;
  const showTouchSpark = (event) => {
    const spark = document.createElement("span");
    spark.className = `desktop-mascot-touch-spark spark-${Math.floor(Math.random() * 3)}`;
    spark.textContent = ["✦", "♡", "·"][Math.floor(Math.random() * 3)];
    spark.style.left = `${event.clientX}px`;
    spark.style.top = `${event.clientY}px`;
    document.body.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  };
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
    setWorkPanelOpen(false);
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
    if (!petDrag.dragged && Math.hypot(event.screenX - petDrag.screenX, event.screenY - petDrag.screenY) < 8) return;
    petDrag.dragged = true;
    document.body.classList.add("is-mascot-window-dragging");
    ipcRenderer.invoke("mascotInline:drag", "move").catch(() => {});
  });
  petZone.addEventListener("pointerup", finishPetDrag);
  petZone.addEventListener("pointercancel", finishPetDrag);
  petZone.addEventListener("pointerenter", () => setOpen(true));
  petZone.addEventListener("pointerleave", scheduleAutoClose);
  petZone.addEventListener("click", (event) => {
    if (performance.now() < suppressPetClickUntil) return;
    showTouchSpark(event);
    if (sending) return;
    const zone = event.clientY < window.innerHeight * .5 ? "head" : "body";
    ipcRenderer.invoke("mascotInline:pet", { zone }).catch(() => {});
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
      resizeInput();
    };
    speechRecognition.onend = () => { speechRecognition = null; micButton.setAttribute("aria-pressed", "false"); input.focus(); };
    speechRecognition.onerror = (event) => setStatus(`音声入力: ${event.error}`);
    speechRecognition.start();
    micButton.setAttribute("aria-pressed", "true");
    setStatus("話してください…", 30_000);
    return true;
  };
  const ensureFallbackRecognition = () => speechRecognition ? true : startFallbackRecognition();

  const decodeRecordedAudio = async (blob) => {
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      const samples = new Float32Array(decoded.length);
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const values = decoded.getChannelData(channel);
        for (let index = 0; index < values.length; index += 1) samples[index] += values[index] / decoded.numberOfChannels;
      }
      return { samples, sampleRate: Math.round(decoded.sampleRate) };
    } finally {
      await context.close().catch(() => {});
    }
  };

  const transcribeWithSherpaOnnx = async (blob) => {
    const { samples, sampleRate } = await decodeRecordedAudio(blob);
    if (!samples.length) throw new Error("録音された音声が空です");
    if (samples.byteLength > 60 * 1024 * 1024) throw new Error("録音が長すぎます。短く区切ってください");
    const packet = new ArrayBuffer(8 + samples.byteLength);
    const view = new DataView(packet);
    view.setInt32(0, sampleRate, true);
    view.setInt32(4, samples.byteLength, true);
    for (let index = 0; index < samples.length; index += 1) view.setFloat32(8 + index * 4, samples[index], true);
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(appState?.sherpaOnnxUrl || "ws://localhost:6006");
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try { socket.send("Done"); } catch {}
        socket.close();
        callback(value);
      };
      const timeout = setTimeout(() => finish(reject, new Error("sherpa-onnxの認識が時間切れになりました")), 45_000);
      socket.onopen = () => {
        for (let offset = 0; offset < packet.byteLength; offset += 10_240) {
          socket.send(packet.slice(offset, Math.min(packet.byteLength, offset + 10_240)));
        }
      };
      socket.onmessage = (event) => {
        try {
          const result = JSON.parse(String(event.data || ""));
          const text = String(result.text ?? result.result ?? "").trim();
          if (!text) throw new Error("音声を認識できませんでした");
          finish(resolve, text);
        } catch (error) {
          finish(reject, new Error(`sherpa-onnxの応答を読み取れません: ${error.message}`));
        }
      };
      socket.onerror = () => finish(reject, new Error("sherpa-onnxへ接続できません"));
      socket.onclose = () => finish(reject, new Error("sherpa-onnxが結果を返す前に接続を終了しました"));
    });
  };

  const toggleRecordedSpeech = async (provider) => {
    if (recordedSpeechRecorder?.state === "recording") {
      recordedSpeechRecorder.stop();
      return;
    }
    recordedSpeechProvider = provider;
    recordedSpeechChunks = [];
    recordedSpeechStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    recordedSpeechRecorder = new MediaRecorder(recordedSpeechStream);
    recordedSpeechRecorder.ondataavailable = (event) => { if (event.data.size) recordedSpeechChunks.push(event.data); };
    recordedSpeechRecorder.onstop = async () => {
      micButton.setAttribute("aria-pressed", "false");
      try {
        setStatus(provider === "sherpa-onnx" ? "sherpa-onnxで認識中…" : "OpenAIで文字起こし中…", 30_000);
        const blob = new Blob(recordedSpeechChunks, { type: recordedSpeechRecorder.mimeType || "audio/webm" });
        if (recordedSpeechProvider === "sherpa-onnx") input.value = await transcribeWithSherpaOnnx(blob);
        else {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          input.value = await ipcRenderer.invoke("mascotInline:transcribe", { bytes, mimeType: blob.type });
        }
        resizeInput();
        input.focus();
        setStatus("音声を入力しました");
      } catch (error) {
        setStatus(error.message, 5000);
      } finally {
        for (const track of recordedSpeechStream?.getTracks?.() || []) track.stop();
        recordedSpeechStream = null;
      }
    };
    recordedSpeechRecorder.start();
    micButton.setAttribute("aria-pressed", "true");
    setStatus("録音中…もう一度押すと認識", 30_000);
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
    if (speechRecognition) {
      speechRecognition.stop();
      return;
    }
    if (realtimePeer) {
      await ipcRenderer.invoke("mascotInline:realtimeStop").catch(() => {});
      closeRealtime();
      setStatus("音声入力を終了しました");
      return;
    }
    if (recordedSpeechRecorder?.state === "recording") {
      recordedSpeechRecorder.stop();
      return;
    }
    appState = await ipcRenderer.invoke("mascotInline:getState").catch(() => appState);
    const provider = appState?.speechInputProvider || "auto";
    if (provider === "browser") {
      ensureFallbackRecognition();
      return;
    }
    if (provider === "sherpa-onnx" || provider === "openai") {
      await toggleRecordedSpeech(provider).catch((error) => setStatus(`音声入力: ${error.message}`, 5000));
      return;
    }
    if (provider === "realtime" && appState?.backend !== "codex") {
      setStatus("Codex RealtimeはCodex接続時のみ利用できます", 5000);
      return;
    }
    if ((provider === "auto" || provider === "realtime") && appState?.backend === "codex" && !realtimeUnavailable) {
      try {
        await startRealtime();
        return;
      } catch (error) {
        ipcRenderer.invoke("mascotInline:realtimeStop").catch(() => {});
        closeRealtime();
        realtimeUnavailable ||= /まだ提供されていません/.test(error.message);
        if (provider === "realtime") {
          setStatus(`Codex Realtimeを開始できません: ${error.message}`, 5000);
          return;
        }
        setStatus(`端末音声認識へ切替: ${error.message}`, 5000);
      }
    }
    if (provider === "realtime") {
      setStatus("Codex Realtimeは現在利用できません", 5000);
      return;
    }
    ensureFallbackRecognition();
  });

  ipcRenderer.on("mascot:speech", (_event, payload) => {
    showSpeech(payload);
  });
  ipcRenderer.on("mascot:workHistory", (_event, payload) => {
    renderWorkHistory(payload);
  });
  ipcRenderer.on("mascot:stream", (_event, payload) => {
    if (payload?.phase === "start") {
      clearPermission();
      sending = true;
      streamWorkMode = payload?.mode === "work";
      streamHasActivity = false;
      clearTimeout(hideTimer);
      bubbleText.textContent = "考え中…";
      bubble.classList.remove("is-expanded", "has-overflow");
      bubbleMore.hidden = true;
      bubble.classList.add("is-visible");
      if (streamWorkMode) setWorkActivity("作業を開始しています");
      return;
    }
    if (payload?.phase === "delta") {
      if (thinkingFillerActive) {
        thinkingFillerActive = false;
        stopTtsPlayback();
      }
      bubbleText.textContent = String(payload.text || "");
      bubble.classList.add("is-visible");
      syncBubbleOverflow();
      const now = performance.now();
      if (now - lastStreamPulseAt > 90) {
        lastStreamPulseAt = now;
        ipcRenderer.invoke("mascotInline:voice", .16 + Math.random() * .2).catch(() => {});
      }
      return;
    }
    if (payload?.phase === "activity") {
      streamHasActivity = true;
      setWorkActivity(String(payload.text || "作業中…"));
      return;
    }
    if (payload?.phase === "done") {
      sending = false;
      if (streamWorkMode) setWorkActivity("作業完了", { finish: true });
      else if (streamHasActivity) setWorkActivity("");
      streamWorkMode = false;
      streamHasActivity = false;
    } else if (payload?.phase === "error") {
      sending = false;
      if (streamWorkMode) setWorkActivity("作業を完了できませんでした", { finish: true });
      else if (streamHasActivity) setWorkActivity("");
      streamWorkMode = false;
      streamHasActivity = false;
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
      resizeInput();
      return;
    }
    if (method === "thread/realtime/transcript/done" && params.role === "user") {
      input.value = "";
      resizeInput();
      setStatus("Codexが考えています…", 30_000);
      return;
    }
    if (method === "thread/realtime/error") {
      realtimeUnavailable ||= Boolean(params.unavailable);
      closeRealtime();
      if ((appState?.speechInputProvider || "auto") === "realtime") {
        setStatus(params.message || "Codex Realtime接続エラー", 5000);
      } else {
        setStatus(`${params.message || "Codex Realtime接続エラー"} 端末音声へ切替`, 5000);
        ensureFallbackRecognition();
      }
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
      stopTtsPlayback();
    }
  });
  ipcRenderer.on("mascot:thinkingFiller", (_event, payload) => {
    const text = String(payload?.text || "").trim();
    if (!text || !sending) return;
    stopTtsPlayback();
    thinkingFillerActive = true;
    if (payload?.ttsProvider === "style-bert-vits2") playStyleBertSpeech(text);
    else speakSystemText(text, payload?.speechLanguage);
  });
  ipcRenderer.invoke("mascotInline:getState").then((state) => {
    appState = state;
    applyInteractionMode(state);
    applyCharacter(state.characters?.find((character) => character.id === state.characterId));
    applyWindowSettings(state);
    ipcRenderer.invoke("mascotInline:getWorkHistory").then(renderWorkHistory).catch(() => {});
  }).catch(() => {});
});
