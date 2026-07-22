// SPDX-License-Identifier: Apache-2.0
const { ipcRenderer } = require("electron");
// Sandboxed Electron preload scripts can only require Electron and a small set
// of built-ins, so keep this renderer-safe projection aligned with vad-profile.cjs.
const VAD_PROFILES = Object.freeze({
  low: { startMin: .035, startFactor: 4.8, onsetMs: 240, stopMin: .009, stopFactor: 1.5, silenceMs: 1200 },
  normal: { startMin: .024, startFactor: 3.8, onsetMs: 160, stopMin: .0075, stopFactor: 1.35, silenceMs: 1050 },
  high: { startMin: .014, startFactor: 2.8, onsetMs: 80, stopMin: .006, stopFactor: 1.25, silenceMs: 850 },
});
const vadProfile = (sensitivity) => VAD_PROFILES[sensitivity] || VAD_PROFILES.normal;

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
    <button type="button" data-permission-action="approve">依頼を許可</button>
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
      <button id="desktopMascotStopButton" type="button" aria-label="応答を中断" hidden>■</button>
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
  const stopButton = dock.querySelector("#desktopMascotStopButton");
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
  let vadActive = false;
  let vadStream = null;
  let vadContext = null;
  let vadAnalyser = null;
  let vadSource = null;
  let vadProcessor = null;
  let vadEngine = "energy";
  let vadSileroDetected = false;
  let vadSileroSegmentComplete = false;
  let vadSileroQueue = Promise.resolve();
  let vadFrame = 0;
  let vadRecorder = null;
  let vadHeaderChunk = null;
  let vadChunks = [];
  let vadPreRoll = [];
  let vadProvider = "sherpa-onnx";
  let vadSpeaking = false;
  let vadProcessing = false;
  let vadResumeAt = 0;
  let vadNoiseFloor = .006;
  let vadLoudSince = 0;
  let vadSilentSince = 0;
  let vadSpeechStartedAt = 0;
  let realtimeUnavailable = false;
  let lastStreamPulseAt = 0;
  let workActivityTimer;
  let streamWorkMode = false;
  let streamHasActivity = false;
  let hideTimer;
  let bubbleHideDuration = 9000;
  let bubblePersistent = false;
  let workHistoryState = { activeWorkRunId: null, runs: [] };
  let workPanelCloseTimer;
  let permissionTimer;
  let ttsAudio = null;
  let ttsPlaybackToken = 0;
  let ttsPulse = null;
  let ttsAudioContext = null;
  let ttsAudioAnalyser = null;
  let ttsAudioSource = null;
  let ttsAudioFrame = null;
  let ttsAudioSamples = null;
  let ttsAudioGraphConnected = false;
  let ttsEnvelope = 0;
  let ttsBusy = false;
  let streamTtsQueue = [];
  let streamTtsDraining = false;
  let streamTtsFinished = false;
  let streamTtsConfig = { enabled: false, provider: "system", language: "ja-JP" };
  let streamFullText = "";
  let streamCurrentSpeechText = "";
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
        const latest = document.createElement("p");
        latest.className = "desktop-mascot-work-latest";
        latest.textContent = run.activities.at(-1);
        item.appendChild(latest);
        if (run.activities.length > 1) {
          const details = document.createElement("details");
          details.className = "desktop-mascot-work-history-details";
          const summary = document.createElement("summary");
          summary.textContent = `進捗履歴（${run.activities.length}件）`;
          const activities = document.createElement("ul");
          activities.className = "desktop-mascot-work-activities";
          for (const activity of run.activities) {
            const row = document.createElement("li");
            row.textContent = activity;
            activities.appendChild(row);
          }
          details.append(summary, activities);
          item.appendChild(details);
        }
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
  const setSendingControls = (busy) => {
    sending = Boolean(busy);
    sendButton.disabled = sending;
    sendButton.hidden = sending;
    stopButton.hidden = !sending;
    stopButton.disabled = false;
    modeButton.disabled = sending;
    workTarget.disabled = sending;
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
    if (bubblePersistent) return;
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
    stopTtsPlayback();
    bubblePersistent = false;
    const permissionType = String(result?.permissionRequest?.type || "");
    const question = String(result?.text || "今回だけ許可してもいい？");
    streamFullText = question;
    streamCurrentSpeechText = "";
    bubbleText.textContent = question;
    permissionActions.dataset.requestId = String(result?.permissionRequest?.id || "");
    permissionActions.dataset.permissionType = permissionType;
    permissionActions.querySelector('[data-permission-action="approve"]').textContent = permissionType === "screen"
      ? "今回だけ見る"
      : permissionType === "computer" ? "操作を許可" : "ブラウザを許可";
    permissionActions.hidden = false;
    bubble.classList.remove("is-expanded", "has-overflow", "has-full-reply");
    bubble.classList.add("is-visible", "is-permission");
    bubbleMore.hidden = true;
    permissionTimer = setTimeout(() => {
      clearPermission();
      scheduleBubbleHide(1800);
    }, Math.max(10_000, Number(result?.permissionRequest?.expiresInMs) || 60_000));
    if (appState?.ttsEnabled && question) {
      if (appState.ttsProvider === "style-bert-vits2") playStyleBertSpeech(question);
      else speakSystemText(question, appState.speechLanguage || "ja-JP");
    }
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
      const hasFullReply = Boolean(streamCurrentSpeechText && streamFullText && streamCurrentSpeechText !== streamFullText);
      bubble.classList.toggle("has-overflow", overflow);
      bubble.classList.toggle("has-full-reply", hasFullReply);
      bubbleMore.hidden = !(overflow || hasFullReply);
    };
    measure();
    requestAnimationFrame(measure);
  };
  bubbleMore.addEventListener("click", () => {
    const expanded = !bubble.classList.contains("is-expanded");
    bubble.classList.toggle("is-expanded", expanded);
    bubbleMore.setAttribute("aria-expanded", String(expanded));
    bubbleMore.textContent = expanded ? "閉じる" : "全文";
    if (expanded) {
      if (streamFullText) bubbleText.textContent = streamFullText;
      clearTimeout(hideTimer);
    } else {
      bubbleText.textContent = streamCurrentSpeechText || streamFullText || bubbleText.textContent;
      scheduleBubbleHide(Math.max(9000, bubbleHideDuration));
    }
    syncBubbleOverflow();
  });
  const scheduleAutoClose = () => {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      if (!sending && document.activeElement !== input && !speechRecognition && !vadActive) setOpen(false);
    }, 720);
  };
  const stopTtsPlayback = () => {
    ttsPlaybackToken += 1;
    thinkingFillerActive = false;
    streamTtsQueue = [];
    streamTtsDraining = false;
    streamTtsFinished = false;
    ttsBusy = false;
    bubble.classList.remove("is-speaking");
    window.speechSynthesis?.cancel();
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.src = "";
      ttsAudio = null;
    }
    clearInterval(ttsPulse);
    ttsPulse = null;
    cancelAnimationFrame(ttsAudioFrame);
    ttsAudioFrame = null;
    try { ttsAudioSource?.disconnect(); } catch {}
    ttsAudioSource = null;
    ttsEnvelope = 0;
    ipcRenderer.invoke("mascotInline:voice", 0).catch(() => {});
  };
  const stopTtsPulse = () => {
    clearInterval(ttsPulse);
    ttsPulse = null;
    cancelAnimationFrame(ttsAudioFrame);
    ttsAudioFrame = null;
    ttsEnvelope = 0;
    ipcRenderer.invoke("mascotInline:voice", 0).catch(() => {});
  };
  const textLipLevel = (text, index, tick) => {
    const value = String(text || "");
    if (!value) return 0;
    const character = value[Math.max(0, Math.min(value.length - 1, index))] || "";
    if (/[\s、。！？!?.,]/.test(character)) return 0;
    const vowelBias = /[あかさたなはまやらわがざだばぱアカサタナハマヤラワガザダバパ]/.test(character) ? .18
      : /[いきしちにひみりぎじぢびぴイキシチニヒミリギジヂビピ]/.test(character) ? -.08
        : .04;
    const rhythm = [.1, .3, .18, .44, .24, .36][tick % 6];
    return Math.max(.06, Math.min(.48, rhythm + vowelBias * .55));
  };
  const startTextTtsPulse = (text, indexProvider = () => 0) => {
    stopTtsPulse();
    let tick = 0;
    ttsPulse = setInterval(() => {
      const index = Number(indexProvider()) || 0;
      ipcRenderer.invoke("mascotInline:voice", textLipLevel(text, index, tick++)).catch(() => {});
    }, 82);
  };
  const startMeasuredTtsPulse = async (audio, fallbackText) => {
    stopTtsPulse();
    try {
      ttsAudioContext ||= new AudioContext();
      ttsAudioAnalyser ||= ttsAudioContext.createAnalyser();
      ttsAudioAnalyser.fftSize = 512;
      ttsAudioAnalyser.smoothingTimeConstant = .18;
      ttsAudioSamples ||= new Float32Array(ttsAudioAnalyser.fftSize);
      try { ttsAudioSource?.disconnect(); } catch {}
      ttsAudioSource = ttsAudioContext.createMediaElementSource(audio);
      ttsAudioSource.connect(ttsAudioAnalyser);
      if (!ttsAudioGraphConnected) {
        ttsAudioAnalyser.connect(ttsAudioContext.destination);
        ttsAudioGraphConnected = true;
      }
      await ttsAudioContext.resume();
      let lastSentAt = 0;
      const update = (now) => {
        if (audio !== ttsAudio || audio.paused || audio.ended) return;
        ttsAudioAnalyser.getFloatTimeDomainData(ttsAudioSamples);
        let sum = 0;
        for (const sample of ttsAudioSamples) sum += sample * sample;
        const rms = Math.sqrt(sum / ttsAudioSamples.length);
        const target = Math.max(0, Math.min(.5, (rms - .004) * 5.2));
        const follow = target > ttsEnvelope ? .4 : .16;
        ttsEnvelope += (target - ttsEnvelope) * follow;
        if (now - lastSentAt >= 44) {
          lastSentAt = now;
          ipcRenderer.invoke("mascotInline:voice", ttsEnvelope < .03 ? 0 : Math.min(.5, Math.pow(ttsEnvelope, .9))).catch(() => {});
        }
        ttsAudioFrame = requestAnimationFrame(update);
      };
      ttsAudioFrame = requestAnimationFrame(update);
    } catch {
      const startedAt = performance.now();
      startTextTtsPulse(fallbackText, () => Math.floor((performance.now() - startedAt) / 140));
    }
  };
  const setTtsBusy = (busy) => {
    ttsBusy = Boolean(busy);
    bubble.classList.toggle("is-speaking", ttsBusy);
  };
  const playAudioSource = (source, text, token, onStart) => new Promise((resolve, reject) => {
    if (token !== ttsPlaybackToken) return resolve();
    ttsAudio = new Audio(source);
    ttsAudio.preload = "auto";
    ttsAudio.onplay = () => {
      onStart?.();
      startMeasuredTtsPulse(ttsAudio, text);
    };
    ttsAudio.onended = () => {
      stopTtsPulse();
      try { ttsAudioSource?.disconnect(); } catch {}
      ttsAudioSource = null;
      ttsAudio = null;
      resolve();
    };
    ttsAudio.onerror = () => {
      stopTtsPulse();
      const detail = ({ 1: "再生が中断されました", 2: "音声データを読み込めません", 3: "音声形式をデコードできません", 4: "音声形式に対応していません" })[ttsAudio?.error?.code];
      reject(new Error(`生成した音声を再生できません${detail ? `（${detail}）` : ""}。`));
    };
    ttsAudio.play().catch(reject);
  });
  const speakSystemSegment = (text, language, token, onStart) => new Promise((resolve) => {
    if (!window.speechSynthesis || token !== ttsPlaybackToken) return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = String(language || "ja-JP");
    utterance.rate = 1.03;
    let boundaryIndex = 0;
    let startedAt = 0;
    utterance.onstart = () => {
      onStart?.();
      startedAt = performance.now();
      startTextTtsPulse(text, () => Math.max(boundaryIndex, Math.floor((performance.now() - startedAt) / 140)));
    };
    utterance.onboundary = (event) => { boundaryIndex = Math.max(boundaryIndex, Number(event.charIndex) || 0); };
    utterance.onend = () => { stopTtsPulse(); resolve(); };
    utterance.onerror = () => { stopTtsPulse(); resolve(); };
    window.speechSynthesis.speak(utterance);
  });
  const playSpeechSegment = async (segment, provider, language, token) => {
    const text = String(segment?.text || segment || "").trim();
    const spokenText = String(segment?.spokenText || text).trim();
    if (!text) return;
    let activated = false;
    const activate = () => {
      if (activated) return;
      activated = true;
      streamCurrentSpeechText = text;
      if (!bubble.classList.contains("is-expanded")) bubbleText.textContent = text;
      syncBubbleOverflow();
      if (segment?.expression) ipcRenderer.invoke("mascotInline:expression", segment.expression).catch(() => {});
    };
    if (provider === "style-bert-vits2") {
      const result = await ipcRenderer.invoke("mascotInline:synthesizeTts", spokenText);
      for (const source of result?.audioDataUrls || []) {
        if (token !== ttsPlaybackToken) return;
        await playAudioSource(source, spokenText, token, activate);
      }
      return;
    }
    await speakSystemSegment(spokenText, language, token, activate);
  };
  const finishTtsPlayback = () => {
    stopTtsPulse();
    ttsAudio = null;
    setTtsBusy(false);
    if (vadActive) vadResumeAt = performance.now() + 650;
    if (streamTtsFinished && !streamTtsQueue.length) {
      streamCurrentSpeechText = "";
      if (!bubble.classList.contains("is-expanded") && streamFullText) bubbleText.textContent = streamFullText;
      ipcRenderer.invoke("mascotInline:expression", { emotion: null, forceMouth: null, forceEyesClosed: null, durationMs: 100 }).catch(() => {});
      syncBubbleOverflow();
    }
  };
  const drainStreamTtsQueue = async () => {
    if (thinkingFillerActive || streamTtsDraining || !streamTtsConfig.enabled || !streamTtsQueue.length) return;
    const token = ttsPlaybackToken;
    streamTtsDraining = true;
    setTtsBusy(true);
    try {
      while (token === ttsPlaybackToken && streamTtsQueue.length) {
        const segment = streamTtsQueue.shift();
        await playSpeechSegment(segment, streamTtsConfig.provider, streamTtsConfig.language, token);
      }
    } catch (error) {
      if (token === ttsPlaybackToken) {
        streamTtsQueue = [];
        setStatus(error.message, 5000);
      }
    } finally {
      if (token === ttsPlaybackToken) {
        streamTtsDraining = false;
        finishTtsPlayback();
        if (streamTtsQueue.length) drainStreamTtsQueue();
        else if (streamTtsFinished) scheduleBubbleHide(Math.max(9000, bubbleHideDuration));
      }
    }
  };
  const queueStreamSpeech = (segments) => {
    if (!streamTtsConfig.enabled) return;
    for (const segment of Array.isArray(segments) ? segments : []) {
      const text = String(segment?.text || segment || "").trim();
      if (text) streamTtsQueue.push(typeof segment === "object" ? { ...segment, text } : { text });
    }
    drainStreamTtsQueue();
  };
  const playStandaloneSpeech = async (text, provider, language, expression = null, spokenText = text) => {
    const token = ttsPlaybackToken;
    setTtsBusy(true);
    try {
      await playSpeechSegment({ text, spokenText, expression }, provider, language, token);
    } catch (error) {
      if (token === ttsPlaybackToken) setStatus(error.message, 5000);
    } finally {
      if (token === ttsPlaybackToken) finishTtsPlayback();
    }
  };
  const playStyleBertSpeech = (text, expression, spokenText) => playStandaloneSpeech(text, "style-bert-vits2", "ja-JP", expression, spokenText);
  const speakSystemText = (text, language, expression, spokenText) => playStandaloneSpeech(text, "system", language, expression, spokenText);
  const showSpeech = (payload) => {
    clearPermission();
    clearTimeout(hideTimer);
    streamFullText = "";
    streamCurrentSpeechText = "";
    bubbleText.textContent = String(payload?.text || "");
    bubble.classList.remove("is-expanded", "has-overflow", "has-full-reply");
    bubbleMore.hidden = true;
    bubbleMore.textContent = "全文";
    bubbleMore.setAttribute("aria-expanded", "false");
    bubble.classList.toggle("is-visible", Boolean(bubbleText.textContent));
    bubbleHideDuration = Math.max(1500, Number(payload?.durationMs) || 9000);
    bubblePersistent = Boolean(payload?.persistent);
    syncBubbleOverflow();
    scheduleBubbleHide(bubbleHideDuration);
    stopTtsPlayback();
    thinkingFillerActive = false;
    if (payload?.ttsEnabled && bubbleText.textContent && payload?.ttsProvider === "style-bert-vits2") {
      playStyleBertSpeech(bubbleText.textContent, payload?.expression, payload?.spokenText);
    } else if (payload?.ttsEnabled && bubbleText.textContent && window.speechSynthesis) {
      speakSystemText(bubbleText.textContent, payload.speechLanguage, payload?.expression, payload?.spokenText);
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
    if (!action || !requestId || !["screen", "browser", "computer"].includes(permissionType) || sending) return;
    const isScreen = permissionType === "screen";
    const isComputer = permissionType === "computer";
    sending = true;
    sendButton.disabled = true;
    modeButton.disabled = true;
    workTarget.disabled = true;
    setStatus(action === "approve"
      ? isScreen ? "画面を1枚だけ取得しています…" : isComputer ? "Windows操作を準備しています…" : "専用ブラウザを準備しています…"
      : "許可を取り消しています…", 30_000);
    try {
      const channel = action === "approve"
        ? isScreen ? "mascotInline:approveScreenShare" : isComputer ? "mascotInline:approveComputerUse" : "mascotInline:approveBrowserUse"
        : isScreen ? "mascotInline:declineScreenShare" : isComputer ? "mascotInline:declineComputerUse" : "mascotInline:declineBrowserUse";
      const result = await ipcRenderer.invoke(
        channel,
        requestId,
      );
      clearPermission();
      if (!result.streamed) showSpeech({
        text: result.text,
        durationMs: 9000,
        ttsEnabled: Boolean(appState?.ttsEnabled),
        ttsProvider: appState?.ttsProvider || "system",
        speechLanguage: appState?.speechLanguage || "ja-JP",
      });
      setStatus(action === "approve"
        ? isScreen ? "画面を確認しました" : isComputer ? "Windows操作が完了しました" : "ブラウザ確認が完了しました"
        : isScreen ? "画面は共有されませんでした" : isComputer ? "Windowsは操作されませんでした" : "ブラウザは開かれませんでした");
    } catch (error) {
      clearPermission();
      showSpeech({ text: `エラー: ${error.message}`, durationMs: 12_000 });
      setStatus(isScreen ? "画面を共有できませんでした" : isComputer ? "Windowsを操作できませんでした" : "ブラウザを利用できませんでした");
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
    setSendingControls(true);
    setStatus(appState?.interactionMode === "work" ? "作業を開始…" : "考え中…", 30_000);
    try {
      const result = await ipcRenderer.invoke("mascotInline:chat", message);
      if (["screen", "browser", "computer"].includes(result.permissionRequest?.type)) {
        showPermission(result);
        setStatus("「いいよ」「やめて」と話しても選べます", 9000);
      } else if (!result.streamed) {
        showSpeech({
          text: result.text,
          durationMs: 9000,
          ttsEnabled: Boolean(appState?.ttsEnabled),
          ttsProvider: appState?.ttsProvider || "system",
          speechLanguage: appState?.speechLanguage || "ja-JP",
        });
      }
      if (!["screen", "browser", "computer"].includes(result.permissionRequest?.type)) {
        setStatus(result.permissionDeclined
          ? result.permissionType === "browser" ? "ブラウザは開かれませんでした" : result.permissionType === "computer" ? "Windowsは操作されませんでした" : "画面は共有されませんでした"
          : result.mode === "work" ? `${result.workDirectoryName || "選択フォルダー"}で作業完了` : result.provider === "codex" ? "Codexから返答" : "OpenAIから返答");
      }
    } catch (error) {
      const interrupted = /interrupt|cancel|abort|中断/i.test(String(error.message || ""));
      const interruptedText = appState?.interactionMode === "work"
        ? "作業を中断しました。履歴から内容を確認できます。"
        : "応答を中断しました。続けて修正を送れます。";
      showSpeech({ text: interrupted ? interruptedText : `エラー: ${error.message}`, durationMs: 12_000 });
      setStatus(interrupted ? appState?.interactionMode === "work" ? "作業を中断しました" : "応答を中断しました" : "送信できませんでした");
    } finally {
      setSendingControls(false);
      input.focus();
    }
  });

  stopButton.addEventListener("click", async () => {
    if (!sending || stopButton.disabled) return;
    stopButton.disabled = true;
    setStatus("中断しています…", 30_000);
    try {
      await ipcRenderer.invoke("mascotInline:interruptActive");
    } catch (error) {
      stopButton.disabled = false;
      setStatus(error.message, 5000);
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
  let hoverState = false;
  const reportHover = (hovered) => {
    const now = performance.now();
    if (hovered === hoverState && (!hovered || now - hoverSentAt < 180)) return;
    hoverState = hovered;
    hoverSentAt = now;
    ipcRenderer.invoke("mascotInline:hover", hovered).catch(() => {});
  };
  // Track the whole transparent app window. Listening only on the canvas made
  // hover turn off as soon as the pointer crossed into the pet/chat overlays.
  window.addEventListener("pointerenter", () => reportHover(true), true);
  window.addEventListener("pointermove", () => reportHover(true), true);
  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) reportHover(false);
  }, true);
  window.addEventListener("blur", () => reportHover(false));
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
  petZone.addEventListener("click", async (event) => {
    if (performance.now() < suppressPetClickUntil) return;
    showTouchSpark(event);
    if (sending) return;
    const zone = event.clientY < window.innerHeight * .5 ? "head" : "body";
    try {
      const result = await ipcRenderer.invoke("mascotInline:pet", { zone });
      showSpeech(result);
    } catch (error) {
      setStatus(`クリック反応: ${error.message}`, 5000);
    }
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
    return ipcRenderer.invoke("mascotInline:transcribeSherpa", { samples, sampleRate });
  };

  const transcribeRecordedBlob = async (blob, provider) => {
    if (provider === "sherpa-onnx") return transcribeWithSherpaOnnx(blob);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return ipcRenderer.invoke("mascotInline:transcribe", { bytes, mimeType: blob.type });
  };

  const sendCodexAudioBlob = async (blob) => {
    setSendingControls(true);
    setOpen(true);
    setStatus("Codexへ音声を送信しています…", 30_000);
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const result = await ipcRenderer.invoke("mascotInline:chatAudio", { bytes, mimeType: blob.type });
      if (!result.streamed) showSpeech({ text: result.text, durationMs: 9000 });
      setStatus(result.mode === "work" ? `${result.workDirectoryName || "選択フォルダー"}で音声作業を完了` : "Codexが音声へ応答しました");
      return result;
    } catch (error) {
      const interrupted = /interrupt|cancel|abort|中断/i.test(String(error.message || ""));
      showSpeech({ text: interrupted ? "応答を中断しました。" : `エラー: ${error.message}`, durationMs: 12_000 });
      setStatus(interrupted ? "応答を中断しました" : "音声を送信できませんでした", 5000);
      throw error;
    } finally {
      setSendingControls(false);
    }
  };

  const setVadUi = (phase) => {
    const active = phase !== "off";
    micButton.setAttribute("aria-pressed", String(active));
    micButton.classList.toggle("is-vad-waiting", phase === "waiting");
    micButton.classList.toggle("is-vad-speaking", phase === "speaking");
    micButton.classList.toggle("is-vad-processing", phase === "processing");
    micButton.textContent = phase === "speaking" ? "◉" : phase === "processing" ? "…" : "●";
    micButton.setAttribute("aria-label", active ? "音声待機を停止" : "音声入力");
  };

  const cleanupVadMedia = () => {
    cancelAnimationFrame(vadFrame);
    vadFrame = 0;
    if (vadRecorder?.state === "recording") vadRecorder.stop();
    vadRecorder = null;
    vadHeaderChunk = null;
    vadChunks = [];
    vadPreRoll = [];
    try { vadProcessor?.disconnect?.(); } catch {}
    try { vadSource?.disconnect?.(); } catch {}
    vadProcessor = null;
    vadSource = null;
    if (vadEngine === "silero") ipcRenderer.invoke("mascotInline:vadStop").catch(() => {});
    vadEngine = "energy";
    vadSileroDetected = false;
    vadSileroSegmentComplete = false;
    for (const track of vadStream?.getTracks?.() || []) track.stop();
    vadStream = null;
    vadAnalyser = null;
    const context = vadContext;
    vadContext = null;
    context?.close?.().catch(() => {});
    vadSpeaking = false;
    vadLoudSince = 0;
    vadSilentSince = 0;
    vadResumeAt = 0;
    setVadUi("off");
  };

  const waitingVoiceStatus = () => "音声待機中…そのまま話してください";

  const processVadTranscript = async (blob, provider) => {
    vadProcessing = true;
    setVadUi("processing");
    try {
      if (provider === "codex-audio") {
        await sendCodexAudioBlob(blob);
        return;
      }
      setStatus(provider === "sherpa-onnx" ? "sherpa-onnxで認識中…" : "OpenAIで文字起こし中…", 30_000);
      const transcript = String(await transcribeRecordedBlob(blob, provider) || "").trim();
      if (!transcript) {
        setStatus(waitingVoiceStatus(), 30_000);
        return;
      }
      const command = transcript;
      input.value = command;
      resizeInput();
      setOpen(true, { focus: true });
      setStatus(`認識: ${command}`, 5000);
      if (appState?.voiceAutoSend !== false) {
        setTimeout(() => {
          if (!sending && input.value.trim() === command) form.requestSubmit();
        }, 420);
      }
    } catch (error) {
      setStatus(error.message, 5000);
    } finally {
      vadProcessing = false;
      if (vadActive) {
        vadResumeAt = performance.now() + 700;
        vadPreRoll = [];
        vadLoudSince = 0;
        vadSilentSince = 0;
        setVadUi("waiting");
        if (!input.value.trim()) setStatus(waitingVoiceStatus(), 30_000);
      } else {
        cleanupVadMedia();
      }
    }
  };

  const finishVadUtterance = () => {
    if (!vadSpeaking) return;
    vadSpeaking = false;
    setVadUi("processing");
    const chunks = vadChunks;
    vadChunks = [];
    const blob = new Blob(chunks, { type: vadRecorder?.mimeType || "audio/webm" });
    if (blob.size > 512) processVadTranscript(blob, vadProvider);
    else if (vadActive) {
      setVadUi("waiting");
      setStatus(waitingVoiceStatus(), 30_000);
    } else if (!vadProcessing) cleanupVadMedia();
  };

  const beginVadUtterance = () => {
    if (!vadActive || vadProcessing || vadSpeaking || vadRecorder?.state !== "recording") return;
    vadChunks = vadPreRoll.splice(0);
    if (vadHeaderChunk && vadChunks[0] !== vadHeaderChunk) vadChunks.unshift(vadHeaderChunk);
    vadSpeaking = true;
    vadSpeechStartedAt = performance.now();
    vadSilentSince = 0;
    setVadUi("speaking");
    setStatus("聞いています…話し終えると自動で認識します", 30_000);
  };

  const runVadFrame = () => {
    if (!vadActive || !vadAnalyser) return;
    const samples = new Float32Array(vadAnalyser.fftSize);
    vadAnalyser.getFloatTimeDomainData(samples);
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    const rms = Math.sqrt(energy / samples.length);
    const now = performance.now();
    const paused = sending || ttsBusy || vadProcessing || now < vadResumeAt;
    const profile = vadProfile(appState?.vadSensitivity);
    if (vadEngine === "silero" && !paused) {
      if (!vadSpeaking && vadSileroDetected) beginVadUtterance();
      if (vadSpeaking && vadSileroSegmentComplete) {
        vadSileroSegmentComplete = false;
        finishVadUtterance();
      }
    } else if (vadEngine !== "silero" && !paused && !vadSpeaking) {
      vadNoiseFloor = Math.min(.04, Math.max(.0035, vadNoiseFloor * .96 + rms * .04));
      const startThreshold = Math.max(profile.startMin, vadNoiseFloor * profile.startFactor);
      if (rms > startThreshold) {
        vadLoudSince ||= now;
        if (now - vadLoudSince >= profile.onsetMs) beginVadUtterance();
      } else {
        vadLoudSince = 0;
      }
    } else if (!paused && vadSpeaking) {
      const stopThreshold = Math.max(profile.stopMin, vadNoiseFloor * profile.stopFactor);
      if (rms < stopThreshold) vadSilentSince ||= now;
      else vadSilentSince = 0;
      if ((vadSilentSince && now - vadSilentSince >= profile.silenceMs && now - vadSpeechStartedAt >= 550)
        || now - vadSpeechStartedAt >= 20_000) finishVadUtterance();
    } else {
      vadLoudSince = 0;
      vadSilentSince = 0;
    }
    vadFrame = requestAnimationFrame(runVadFrame);
  };

  const stopVadListening = () => {
    if (!vadActive && !vadStream) return;
    vadActive = false;
    cancelAnimationFrame(vadFrame);
    vadFrame = 0;
    vadSpeaking = false;
    vadChunks = [];
    vadPreRoll = [];
    if (!vadProcessing) cleanupVadMedia();
    setVadUi("off");
  };

  const startVadListening = async (provider) => {
    if (vadActive) return;
    if (!["codex-audio", "sherpa-onnx", "openai"].includes(provider)) throw new Error("この音声入力方式ではVADを利用できません");
    if (provider === "codex-audio" && appState?.backend !== "codex") throw new Error("Codex app-server接続へ切り替えてください");
    if (provider === "sherpa-onnx" && !appState?.sherpaModel?.installed) {
      throw new Error("設定からsherpa-onnx日本語モデルをダウンロードしてください");
    }
    if (provider === "openai" && !appState?.hasApiKey) throw new Error("OpenAI APIキーを設定してください");
    vadProvider = provider;
    vadStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
    });
    vadContext = new AudioContext();
    await vadContext.resume().catch(() => {});
    vadAnalyser = vadContext.createAnalyser();
    vadAnalyser.fftSize = 1024;
    vadAnalyser.smoothingTimeConstant = .2;
    vadSource = vadContext.createMediaStreamSource(vadStream);
    vadSource.connect(vadAnalyser);
    setStatus("Silero VADを準備しています…", 30_000);
    try {
      await ipcRenderer.invoke("mascotInline:vadStart", appState?.vadSensitivity || "normal");
      vadEngine = "silero";
      vadSileroDetected = false;
      vadSileroSegmentComplete = false;
      vadProcessor = vadContext.createScriptProcessor(2048, 1, 1);
      vadProcessor.onaudioprocess = (event) => {
        if (!vadActive || sending || ttsBusy || vadProcessing) return;
        const source = event.inputBuffer.getChannelData(0);
        const ratio = vadContext.sampleRate / 16_000;
        const length = Math.max(1, Math.floor(source.length / ratio));
        const samples = new Float32Array(length);
        for (let index = 0; index < length; index += 1) {
          const start = Math.floor(index * ratio);
          const end = Math.max(start + 1, Math.min(source.length, Math.floor((index + 1) * ratio)));
          let sum = 0;
          for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) sum += source[sourceIndex];
          samples[index] = sum / (end - start);
        }
        vadSileroQueue = vadSileroQueue.then(async () => {
          if (!vadActive || vadEngine !== "silero") return;
          const result = await ipcRenderer.invoke("mascotInline:vadAccept", samples);
          vadSileroDetected = Boolean(result?.detected);
          if (result?.segmentComplete) vadSileroSegmentComplete = true;
        }).catch(() => {
          vadEngine = "energy";
          vadSileroDetected = false;
          vadSileroSegmentComplete = false;
        });
      };
      vadSource.connect(vadProcessor);
      vadProcessor.connect(vadContext.destination);
    } catch {
      vadEngine = "energy";
      setStatus("Silero VADを準備できないため音量検出を使用します", 5000);
    }
    vadChunks = [];
    vadPreRoll = [];
    vadHeaderChunk = null;
    vadRecorder = new MediaRecorder(vadStream);
    vadRecorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      vadHeaderChunk ||= event.data;
      if (vadSpeaking) {
        vadChunks.push(event.data);
      } else if (!vadProcessing) {
        vadPreRoll.push(event.data);
        if (vadPreRoll.length > 6) vadPreRoll.shift();
      }
    };
    vadRecorder.start(100);
    vadNoiseFloor = .008;
    vadActive = true;
    setVadUi("waiting");
    setStatus(waitingVoiceStatus(), 30_000);
    runVadFrame();
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
        if (recordedSpeechProvider === "codex-audio") {
          await sendCodexAudioBlob(blob);
          return;
        }
        input.value = await transcribeRecordedBlob(blob, recordedSpeechProvider);
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
    if (vadActive || vadStream) {
      stopVadListening();
      setStatus("音声待機を終了しました");
      return;
    }
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
    let provider = appState?.speechInputProvider || "auto";
    if (provider === "auto") provider = appState?.sherpaModel?.installed ? "sherpa-onnx" : "browser";
    if (provider === "browser") {
      ensureFallbackRecognition();
      return;
    }
    if (provider === "codex-audio" || provider === "sherpa-onnx" || provider === "openai") {
      if ((appState?.voiceActivationMode || "vad") !== "manual") {
        await startVadListening(provider).catch((error) => setStatus(`音声入力: ${error.message}`, 5000));
        return;
      }
      await toggleRecordedSpeech(provider).catch((error) => setStatus(`音声入力: ${error.message}`, 5000));
      return;
    }
    if (provider === "realtime" && appState?.backend !== "codex") {
      setStatus("Codex RealtimeはCodex接続時のみ利用できます", 5000);
      return;
    }
    if (provider === "realtime" && appState?.backend === "codex" && !realtimeUnavailable) {
      try {
        await startRealtime();
        return;
      } catch (error) {
        ipcRenderer.invoke("mascotInline:realtimeStop").catch(() => {});
        closeRealtime();
        realtimeUnavailable ||= /まだ提供されていません/.test(error.message);
        setStatus(`Codex Realtimeを開始できません: ${error.message}`, 5000);
        return;
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
      stopTtsPlayback();
      bubblePersistent = false;
      streamFullText = "考え中…";
      streamCurrentSpeechText = "";
      streamTtsConfig = {
        enabled: Boolean(payload?.ttsEnabled),
        provider: payload?.ttsProvider || "system",
        language: payload?.speechLanguage || "ja-JP",
      };
      sending = true;
      streamWorkMode = payload?.mode === "work";
      streamHasActivity = false;
      clearTimeout(hideTimer);
      bubbleText.textContent = streamFullText;
      bubble.classList.remove("is-expanded", "has-overflow", "has-full-reply");
      bubbleMore.hidden = true;
      bubble.classList.add("is-visible");
      if (streamWorkMode) setWorkActivity("作業を開始しています");
      return;
    }
    if (payload?.phase === "delta") {
      streamFullText = String(payload.displayText || payload.text || "");
      if (bubble.classList.contains("is-expanded") || !streamCurrentSpeechText) {
        bubbleText.textContent = streamFullText;
      }
      bubble.classList.add("is-visible");
      syncBubbleOverflow();
      const now = performance.now();
      if (!streamTtsConfig.enabled && now - lastStreamPulseAt > 64) {
        lastStreamPulseAt = now;
        const deltaText = String(payload.delta || streamFullText);
        ipcRenderer.invoke("mascotInline:voice", textLipLevel(deltaText, Math.max(0, deltaText.length - 1), Math.floor(now / 64))).catch(() => {});
      }
      queueStreamSpeech(payload?.speechSegments);
      return;
    }
    if (payload?.phase === "activity") {
      streamHasActivity = true;
      setWorkActivity(String(payload.text || "作業中…"));
      return;
    }
    if (payload?.phase === "done") {
      if (payload?.text) streamFullText = String(payload.displayText || payload.text);
      streamTtsFinished = true;
      bubblePersistent = !streamWorkMode;
      queueStreamSpeech(payload?.speechSegments);
      if (!streamTtsConfig.enabled || (!streamTtsDraining && !streamTtsQueue.length)) {
        streamCurrentSpeechText = "";
        if (!bubble.classList.contains("is-expanded")) bubbleText.textContent = streamFullText;
        if (streamTtsConfig.enabled) finishTtsPlayback();
      }
      syncBubbleOverflow();
      scheduleBubbleHide(Math.max(9000, bubbleHideDuration));
      sending = false;
      if (streamWorkMode) setWorkActivity("作業完了", { finish: true });
      else if (streamHasActivity) setWorkActivity("");
      streamWorkMode = false;
      streamHasActivity = false;
    } else if (payload?.phase === "error") {
      stopTtsPlayback();
      streamCurrentSpeechText = "";
      if (!bubble.classList.contains("is-expanded") && streamFullText) bubbleText.textContent = streamFullText;
      sending = false;
      if (streamWorkMode) setWorkActivity("作業を完了できませんでした", { finish: true });
      else if (streamHasActivity) setWorkActivity("");
      streamWorkMode = false;
      streamHasActivity = false;
    }
    if (!ttsBusy) ipcRenderer.invoke("mascotInline:voice", 0).catch(() => {});
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
    appState = { ...appState, ttsEnabled: Boolean(payload?.enabled), ttsProvider: payload?.provider || "system" };
    if (!payload?.enabled) {
      stopTtsPlayback();
    }
  });
  ipcRenderer.on("mascot:voiceInputSettings", (_event, payload) => {
    const previousProvider = appState?.speechInputProvider;
    const previousMode = appState?.voiceActivationMode;
    const previousSensitivity = appState?.vadSensitivity;
    appState = { ...appState, ...payload };
    if (vadActive && (previousProvider !== appState.speechInputProvider
      || previousMode !== appState.voiceActivationMode
      || previousSensitivity !== appState.vadSensitivity)) {
      stopVadListening({ discard: true });
    }
  });
  ipcRenderer.on("mascot:thinkingFiller", (_event, payload) => {
    const text = String(payload?.text || "").trim();
    if (!text || !sending) return;
    stopTtsPlayback();
    thinkingFillerActive = true;
    const playback = payload?.ttsProvider === "style-bert-vits2"
      ? playStyleBertSpeech(text)
      : speakSystemText(text, payload?.speechLanguage);
    Promise.resolve(playback).finally(() => {
      if (!thinkingFillerActive) return;
      thinkingFillerActive = false;
      streamCurrentSpeechText = "";
      if (!bubble.classList.contains("is-expanded") && streamFullText) bubbleText.textContent = streamFullText;
      syncBubbleOverflow();
      drainStreamTtsQueue();
    });
  });
  ipcRenderer.invoke("mascotInline:getState").then((state) => {
    appState = state;
    applyInteractionMode(state);
    applyCharacter(state.characters?.find((character) => character.id === state.characterId));
    applyWindowSettings(state);
    ipcRenderer.invoke("mascotInline:getWorkHistory").then(renderWorkHistory).catch(() => {});
  }).catch(() => {});
});
