// SPDX-License-Identifier: Apache-2.0
(() => {
  "use strict";

  const api = window.mascotDesktop;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  let state = null;
  let audioStream = null;
  let audioContext = null;
  let analyser = null;
  let meterFrame = 0;
  let lipSyncActive = false;
  let lastVoiceSentAt = 0;
  let speechRecognition = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let realtimePeerConnection = null;
  let realtimeDataChannel = null;
  let realtimeRemoteAudio = null;
  let realtimeStarting = false;
  let realtimeUserTranscript = "";
  let realtimeAssistantMessage = null;
  let speechPulseTimer = null;
  let streamingMessage = null;
  let generatorFile = null;
  let generatorBusy = false;
  let codexAccount = null;
  let onboardingStep = 0;
  let motionPreviewTimer = 0;
  const motionFields = ["avatarSize", "rangeLeft", "rangeRight", "rangeUp", "rangeDown"];

  function setStatus(element, message, error = false) {
    element.textContent = String(message || "");
    element.classList.toggle("is-error", Boolean(error));
  }

  function showPage(name) {
    $$(".nav-tab").forEach((button) => button.classList.toggle("is-active", button.dataset.page === name));
    $$("[data-page-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.pagePanel === name));
  }

  function appendMessage(role, text, thinking = false) {
    const article = document.createElement("article");
    article.className = `message is-${role}${thinking ? " is-thinking" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "YOU" : "P";
    const content = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = role === "user" ? "あなた" : "マスコット";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    content.append(label, paragraph);
    article.append(avatar, content);
    $("#chatLog").appendChild(article);
    $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
    return article;
  }

  function renderCharacters() {
    const grid = $("#characterGrid");
    grid.replaceChildren();
    for (const character of state.characters) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `character-card${character.id === state.characterId ? " is-active" : ""}`;
      button.dataset.characterId = character.id;
      const image = document.createElement("img");
      image.src = character.thumbnailUrl;
      image.alt = "";
      const name = document.createElement("strong");
      name.textContent = character.name;
      const selected = document.createElement("span");
      selected.className = "selected";
      selected.textContent = "✓";
      button.append(image, name, selected);
      button.addEventListener("click", async () => {
        try {
          state = await api.setCharacter(character.id);
          renderCharacters();
          syncCharacterEditor();
          setStatus($("#chatStatus"), `${state.characters.find((item) => item.id === character.id)?.name || character.name}に切り替えました。`);
        } catch (error) {
          setStatus($("#chatStatus"), error.message, true);
        }
      });
      grid.appendChild(button);
    }
  }

  function renderOnboardingCharacters() {
    const grid = $("#onboardingCharacterGrid");
    grid.replaceChildren();
    for (const character of state.characters) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `onboarding-character${character.id === state.characterId ? " is-active" : ""}`;
      const image = document.createElement("img");
      image.src = character.thumbnailUrl;
      image.alt = "";
      const name = document.createElement("strong");
      name.textContent = character.name;
      button.append(image, name);
      button.addEventListener("click", async () => {
        state = await api.setCharacter(character.id);
        renderCharacters();
        renderOnboardingCharacters();
        syncCharacterEditor();
      });
      grid.appendChild(button);
    }
  }

  function currentCharacter() {
    return state.characters.find((character) => character.id === state.characterId) || state.characters[0];
  }

  function syncCharacterEditor() {
    const character = currentCharacter();
    if (!character) return;
    $("#characterNameInput").value = character.name || "";
    $("#characterPersonalityInput").value = character.personality || "";
    $("#bubbleLeftInput").value = character.ui?.bubbleLeft ?? 18;
    $("#bubbleTopInput").value = character.ui?.bubbleTop ?? 24;
    $("#bubbleWidthInput").value = character.ui?.bubbleWidth ?? 68;
    for (const key of motionFields) {
      $(`#${key}Input`).value = character.motion?.[key] ?? (key === "avatarSize" ? 100 : 30);
    }
    syncMotionReadouts();
    setStatus($("#characterProfileStatus"), `${character.name}の設定`);
  }

  function syncMotionReadouts() {
    for (const key of motionFields) {
      $(`#${key}Output`).textContent = `${Math.round(Number($(`#${key}Input`).value) || 0)}%`;
    }
  }

  function currentMotionValues() {
    return Object.fromEntries(motionFields.map((key) => [key, Number($(`#${key}Input`).value)]));
  }

  function previewCharacterMotion() {
    clearTimeout(motionPreviewTimer);
    motionPreviewTimer = setTimeout(() => {
      const character = currentCharacter();
      if (!character) return;
      api.previewCharacterMotion({ id: character.id, motion: currentMotionValues() }).catch((error) => {
        setStatus($("#characterProfileStatus"), error.message, true);
      });
    }, 45);
  }

  function setOnboardingStep(step) {
    onboardingStep = Math.max(0, Math.min(2, Number(step) || 0));
    $$("[data-onboarding-step]").forEach((panel) => panel.classList.toggle("is-active", Number(panel.dataset.onboardingStep) === onboardingStep));
    $$(".onboarding-progress i").forEach((item, index) => item.classList.toggle("is-active", index <= onboardingStep));
    $("#onboardingBackButton").disabled = onboardingStep === 0;
    $("#onboardingStepLabel").textContent = `${onboardingStep + 1} / 3`;
    $("#onboardingNextButton").textContent = onboardingStep === 2 ? "セットアップ完了" : "次へ";
  }

  function syncOnboarding() {
    $("#onboarding").hidden = Boolean(state.onboardingComplete);
    $("#onboardingTtsToggle").checked = Boolean(state.ttsEnabled);
    renderOnboardingCharacters();
    setOnboardingStep(onboardingStep);
  }

  async function finishOnboarding() {
    state = await api.completeOnboarding(true);
    $("#onboarding").hidden = true;
    syncUi();
  }

  function syncGeneratorUi() {
    const available = state?.backend === "codex";
    $("#avatarGeneratorCard").classList.toggle("is-unavailable", !available);
    $("#generateCharacterButton").disabled = !available || !generatorFile || !$("#avatarRightsConfirm").checked || generatorBusy;
  }

  function updateGeneratorProgress(payload = {}) {
    const progress = $("#generatorProgress");
    progress.classList.toggle("is-active", !["done", "error"].includes(payload.phase) && generatorBusy);
    progress.classList.toggle("is-done", payload.phase === "done");
    progress.classList.toggle("is-error", payload.phase === "error");
    if (payload.message) $("#generatorStatus").textContent = payload.message;
  }

  function syncUi() {
    renderCharacters();
    syncCharacterEditor();
    syncGeneratorUi();
    const backend = $(`input[name="backend"][value="${state.backend}"]`);
    if (backend) backend.checked = true;
    $("#openaiModelInput").value = state.openaiModel || "";
    $("#transcriptionModelInput").value = state.transcriptionModel || "";
    $("#codexModelInput").value = state.codexModel || "";
    $("#alwaysOnTopToggle").checked = Boolean(state.alwaysOnTop);
    $("#clickThroughToggle").checked = Boolean(state.clickThrough);
    $("#mouseFollowToggle").checked = Boolean(state.mouseFollow);
    $("#launchAtLoginToggle").checked = Boolean(state.launchAtLogin);
    $("#ttsToggle").checked = Boolean(state.ttsEnabled);
    $("#positionLockedToggle").checked = Boolean(state.positionLocked);
    $("#edgeSnapToggle").checked = Boolean(state.edgeSnap);
    const displaySelect = $("#displaySelect");
    displaySelect.replaceChildren(new Option("自動（メインモニター）", ""));
    for (const display of state.displays || []) displaySelect.appendChild(new Option(display.label, display.id));
    displaySelect.value = state.preferredDisplayId || "";
    const voiceMode = $("#speechInputMode");
    voiceMode.textContent = state.backend === "codex" ? "Codex Realtime" : "端末音声認識";
    voiceMode.classList.toggle("is-fallback", state.backend !== "codex");
    $("#apiKeyState").textContent = state.hasApiKey
      ? `APIキー設定済み（${state.apiKeyPersistence === "encrypted" ? "暗号化保存" : "今回のみ"}）`
      : "APIキー未設定";
    $("#connectionLabel").textContent = state.backend === "codex" && codexAccount?.signedIn ? "Codex · ChatGPT" : state.backend === "codex" ? "Codex app-server" : "OpenAI API";
    $("#connectionDetail").textContent = state.backend === "codex" && codexAccount?.signedIn
      ? `ログイン済み${codexAccount.planType ? ` · ${codexAccount.planType}` : ""}`
      : state.backend === "codex" ? "アカウント確認中" : state.hasApiKey ? "APIキー設定済み" : "APIキー未設定";
    $("#connectionPill").classList.toggle("is-error", state.backend === "openai" && !state.hasApiKey);
    setStatus($("#chatStatus"), state.backend === "codex" ? "Codex app-serverを使用します。" : "OpenAI Responses APIを使用します。");
    syncOnboarding();
  }

  async function refreshCodexAccount() {
    const label = $("#codexAccountState");
    const button = $("#codexLoginButton");
    const onboardingLabel = $("#onboardingAccountState");
    const onboardingButton = $("#onboardingLoginButton");
    button.disabled = true;
    onboardingButton.disabled = true;
    try {
      const account = await api.getCodexAccount();
      codexAccount = account;
      button.dataset.action = account.signedIn ? "logout" : "login";
      button.textContent = account.signedIn ? "ChatGPTからログアウト" : "ChatGPTでログイン";
      button.classList.toggle("button-secondary", !account.signedIn);
      button.classList.toggle("button-quiet", account.signedIn);
      if (account.type === "chatgpt") {
        label.textContent = `ChatGPTログイン済み（${account.planType || "プラン不明"}）`;
        onboardingLabel.textContent = `ChatGPTログイン済み（${account.planType || "プラン不明"}）`;
        onboardingButton.textContent = "接続済み";
        if (state.backend === "codex") {
          $("#connectionLabel").textContent = "Codex · ChatGPT";
          $("#connectionDetail").textContent = `ログイン済み${account.planType ? ` · ${account.planType}` : ""}`;
        }
        return true;
      }
      if (account.signedIn) {
        label.textContent = `${account.type || "Codex"} でログイン済み`;
        onboardingLabel.textContent = `${account.type || "Codex"} でログイン済み`;
        onboardingButton.textContent = "接続済み";
        if (state.backend === "codex") {
          $("#connectionLabel").textContent = "Codex app-server";
          $("#connectionDetail").textContent = "ログイン済み";
        }
        return true;
      }
      label.textContent = "ChatGPTにログインしていません。";
      onboardingLabel.textContent = "ChatGPTにログインしていません。";
      onboardingButton.textContent = "ChatGPTでログイン";
      if (state.backend === "codex") $("#connectionDetail").textContent = "ChatGPT未ログイン";
      return false;
    } catch (error) {
      codexAccount = null;
      button.dataset.action = "login";
      button.textContent = "ChatGPTでログイン";
      label.textContent = `Codex CLIを確認できません: ${error.message}`;
      onboardingLabel.textContent = `Codex CLIを確認できません: ${error.message}`;
      onboardingButton.textContent = "再確認";
      if (state.backend === "codex") $("#connectionDetail").textContent = "接続を確認できません";
      return false;
    } finally {
      button.disabled = false;
      onboardingButton.disabled = Boolean(codexAccount?.signedIn);
    }
  }

  async function waitForCodexLogin() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (await refreshCodexAccount()) {
        setStatus($("#connectionStatus"), "ChatGPTログインを確認しました。");
        return;
      }
    }
    setStatus($("#connectionStatus"), "ログイン確認が時間切れになりました。接続テストでも再確認できます。", true);
  }

  async function saveSettings() {
    state = await api.saveSettings({
      backend: $("input[name='backend']:checked")?.value || "codex",
      openaiModel: $("#openaiModelInput").value.trim(),
      transcriptionModel: $("#transcriptionModelInput").value.trim(),
      codexModel: $("#codexModelInput").value.trim(),
      alwaysOnTop: $("#alwaysOnTopToggle").checked,
      clickThrough: $("#clickThroughToggle").checked,
      mouseFollow: $("#mouseFollowToggle").checked,
      launchAtLogin: $("#launchAtLoginToggle").checked,
      ttsEnabled: $("#ttsToggle").checked,
      speechLanguage: state?.speechLanguage || "ja-JP",
      positionLocked: $("#positionLockedToggle").checked,
      edgeSnap: $("#edgeSnapToggle").checked,
      preferredDisplayId: $("#displaySelect").value,
    });
    syncUi();
  }

  async function ensureAudioStream() {
    if (audioStream?.active) return audioStream;
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    return audioStream;
  }

  async function startLipSync() {
    await ensureAudioStream();
    audioContext ||= new AudioContext();
    analyser ||= audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.45;
    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyser);
    lipSyncActive = true;
    $("#micLipSyncButton").setAttribute("aria-pressed", "true");
    const samples = new Uint8Array(analyser.fftSize);
    const update = (now) => {
      if (!lipSyncActive) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) {
        const sample = (value - 128) / 128;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / samples.length);
      const level = Math.min(2, rms * 9);
      $("#micMeter i").style.width = `${Math.min(100, level * 85)}%`;
      if (now - lastVoiceSentAt > 48) {
        lastVoiceSentAt = now;
        api.sendVoiceLevel(level).catch(() => {});
      }
      meterFrame = requestAnimationFrame(update);
    };
    meterFrame = requestAnimationFrame(update);
  }

  function stopLipSync() {
    lipSyncActive = false;
    cancelAnimationFrame(meterFrame);
    $("#micLipSyncButton").setAttribute("aria-pressed", "false");
    $("#micMeter i").style.width = "0%";
    api.sendVoiceLevel(0).catch(() => {});
  }

  async function toggleLipSync() {
    try {
      if (lipSyncActive) stopLipSync();
      else await startLipSync();
    } catch (error) {
      setStatus($("#chatStatus"), `マイクを開始できません: ${error.message}`, true);
    }
  }

  function startBrowserSpeechRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return false;
    if (speechRecognition) {
      speechRecognition.stop();
      return true;
    }
    speechRecognition = new Recognition();
    speechRecognition.lang = state.speechLanguage || "ja-JP";
    speechRecognition.interimResults = true;
    speechRecognition.continuous = false;
    let finalText = "";
    speechRecognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const value = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += value;
        else interim += value;
      }
      $("#chatInput").value = finalText + interim;
    };
    speechRecognition.onerror = (event) => setStatus($("#chatStatus"), `音声入力: ${event.error}`, true);
    speechRecognition.onend = () => {
      speechRecognition = null;
      $("#speechInputButton").setAttribute("aria-pressed", "false");
      setStatus($("#chatStatus"), finalText ? "音声を入力欄へ追加しました。" : "音声入力を終了しました。");
    };
    speechRecognition.start();
    $("#speechInputButton").setAttribute("aria-pressed", "true");
    setStatus($("#chatStatus"), "話してください…");
    return true;
  }

  function closeRealtimeAudio() {
    try { realtimeDataChannel?.close(); } catch {}
    try { realtimePeerConnection?.close(); } catch {}
    realtimeRemoteAudio?.pause();
    if (realtimeRemoteAudio) realtimeRemoteAudio.srcObject = null;
    realtimeDataChannel = null;
    realtimePeerConnection = null;
    realtimeRemoteAudio = null;
    realtimeStarting = false;
    realtimeUserTranscript = "";
    $("#speechInputButton").setAttribute("aria-pressed", "false");
  }

  async function stopCodexRealtimeVoice({ quiet = false } = {}) {
    if (!realtimePeerConnection && !realtimeStarting) return false;
    try {
      await api.stopCodexRealtime();
    } catch (error) {
      if (!quiet) setStatus($("#chatStatus"), `音声会話の終了: ${error.message}`, true);
    } finally {
      closeRealtimeAudio();
    }
    if (!quiet) setStatus($("#chatStatus"), "Codex Realtime音声入力を終了しました。");
    return true;
  }

  async function startCodexRealtimeVoice() {
    const stream = await ensureAudioStream();
    const peer = new RTCPeerConnection();
    realtimePeerConnection = peer;
    realtimeStarting = true;
    realtimeUserTranscript = "";
    realtimeAssistantMessage = null;
    for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
    realtimeRemoteAudio = new Audio();
    realtimeRemoteAudio.autoplay = true;
    peer.addEventListener("track", (event) => {
      realtimeRemoteAudio.srcObject = event.streams[0] || new MediaStream([event.track]);
      realtimeRemoteAudio.play().catch(() => {});
    });
    realtimeDataChannel = peer.createDataChannel("oai-events");
    peer.addEventListener("connectionstatechange", () => {
      if (["failed", "disconnected"].includes(peer.connectionState)) {
        setStatus($("#chatStatus"), "Codex Realtime音声接続が切れました。", true);
        closeRealtimeAudio();
      }
    });
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await api.startCodexRealtime({ sdp: peer.localDescription?.sdp || offer.sdp });
    realtimeStarting = false;
    $("#speechInputButton").setAttribute("aria-pressed", "true");
    $("#speechInputMode").textContent = "Codex Realtime";
    $("#speechInputMode").classList.remove("is-fallback");
    setStatus($("#chatStatus"), "Codex Realtimeへ接続中…そのまま話してください。");
  }

  async function handleCodexRealtimeEvent(message = {}) {
    const method = String(message.method || "");
    const params = message.params || {};
    if (method === "thread/realtime/sdp") {
      if (realtimePeerConnection && params.sdp) {
        await realtimePeerConnection.setRemoteDescription({ type: "answer", sdp: String(params.sdp) });
      }
      return;
    }
    if (method === "thread/realtime/started") {
      setStatus($("#chatStatus"), "Codex Realtime音声入力中。もう一度押すと終了します。");
      return;
    }
    if (method === "thread/realtime/transcript/delta") {
      const delta = String(params.delta || "");
      if (params.role === "user") {
        realtimeUserTranscript += delta;
        $("#chatInput").value = realtimeUserTranscript;
        setStatus($("#chatStatus"), "聞き取っています…");
      }
      if (params.role === "assistant") {
        if (!realtimeAssistantMessage) realtimeAssistantMessage = appendMessage("assistant", "");
        realtimeAssistantMessage.querySelector("p").textContent += delta;
        $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
      }
      return;
    }
    if (method === "thread/realtime/transcript/done") {
      const text = String(params.text || "").trim();
      if (params.role === "user" && text) {
        appendMessage("user", text);
        realtimeUserTranscript = "";
        $("#chatInput").value = "";
        realtimeAssistantMessage = null;
        setStatus($("#chatStatus"), "Codexが考えています…");
      }
      if (params.role === "assistant" && text) {
        if (!realtimeAssistantMessage) realtimeAssistantMessage = appendMessage("assistant", text);
        else realtimeAssistantMessage.querySelector("p").textContent = text;
        setStatus($("#chatStatus"), "Codex Realtimeから応答しました。");
      }
      return;
    }
    if (method === "thread/realtime/error") {
      setStatus($("#chatStatus"), `Codex Realtime: ${params.message || "音声接続エラー"}`, true);
      closeRealtimeAudio();
      return;
    }
    if (method === "thread/realtime/closed") {
      closeRealtimeAudio();
      setStatus($("#chatStatus"), "Codex Realtime音声入力を終了しました。");
    }
  }

  async function toggleRecordedSpeechInput() {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      return;
    }
    const stream = await ensureAudioStream();
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordedChunks.push(event.data); };
    mediaRecorder.onstop = async () => {
      $("#speechInputButton").setAttribute("aria-pressed", "false");
      try {
        setStatus($("#chatStatus"), "OpenAIで音声を文字にしています…");
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        $("#chatInput").value = await api.transcribe({ bytes, mimeType: blob.type });
        setStatus($("#chatStatus"), "音声を入力欄へ追加しました。");
      } catch (error) {
        setStatus($("#chatStatus"), error.message, true);
      }
    };
    mediaRecorder.start();
    $("#speechInputButton").setAttribute("aria-pressed", "true");
    setStatus($("#chatStatus"), "録音中…もう一度押すと文字に変換します。");
  }

  async function toggleSpeechInput() {
    if (realtimePeerConnection || realtimeStarting) {
      await stopCodexRealtimeVoice();
      return;
    }
    if (state.backend === "codex") {
      try {
        await startCodexRealtimeVoice();
        return;
      } catch (error) {
        api.stopCodexRealtime().catch(() => {});
        closeRealtimeAudio();
        $("#speechInputMode").textContent = "端末音声認識";
        $("#speechInputMode").classList.add("is-fallback");
        setStatus($("#chatStatus"), `Codex Realtimeを利用できないため端末音声認識へ切り替えます: ${error.message}`, true);
      }
    }
    if (startBrowserSpeechRecognition()) return;
    try {
      await toggleRecordedSpeechInput();
    } catch (error) {
      setStatus($("#chatStatus"), `音声入力を開始できません: ${error.message}`, true);
    }
  }

  function stopSpeechPulse() {
    clearInterval(speechPulseTimer);
    speechPulseTimer = null;
    api.sendVoiceLevel(0).catch(() => {});
  }

  function speakResponse(text) {
    if (!state.ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    stopSpeechPulse();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.speechLanguage || "ja-JP";
    utterance.rate = 1.03;
    utterance.pitch = 1.05;
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ja")) || null;
    utterance.onstart = () => {
      let phase = 0;
      speechPulseTimer = setInterval(() => {
        phase += 0.8;
        api.sendVoiceLevel(0.12 + Math.abs(Math.sin(phase)) * 0.28).catch(() => {});
      }, 80);
    };
    utterance.onend = stopSpeechPulse;
    utterance.onerror = stopSpeechPulse;
    speechSynthesis.speak(utterance);
  }

  async function sendChat() {
    const input = $("#chatInput");
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    appendMessage("user", message);
    const thinking = appendMessage("assistant", "考え中", true);
    streamingMessage = thinking;
    $("#sendButton").disabled = true;
    setStatus($("#chatStatus"), "応答を待っています…");
    try {
      const result = await api.sendChat(message);
      const paragraph = thinking.querySelector("p");
      thinking.classList.remove("is-thinking");
      paragraph.textContent = result.text;
      setStatus($("#chatStatus"), result.provider === "codex" ? "Codexから応答しました。" : "OpenAI APIから応答しました。");
    } catch (error) {
      thinking.classList.remove("is-thinking");
      thinking.querySelector("p").textContent = `エラー: ${error.message}`;
      setStatus($("#chatStatus"), error.message, true);
    } finally {
      $("#sendButton").disabled = false;
      streamingMessage = null;
      input.focus();
    }
  }

  function bindEvents() {
    api.onStateChanged?.((nextState) => {
      state = nextState;
      syncUi();
    });
    api.onChatStream?.((payload) => {
      if (!streamingMessage) return;
      const paragraph = streamingMessage.querySelector("p");
      if (payload?.phase === "start") paragraph.textContent = "考え中";
      if (payload?.phase === "delta") {
        streamingMessage.classList.remove("is-thinking");
        paragraph.textContent = String(payload.text || "");
        $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
      }
    });
    api.onCodexRealtime?.((message) => {
      handleCodexRealtimeEvent(message).catch((error) => {
        setStatus($("#chatStatus"), `音声イベント: ${error.message}`, true);
        closeRealtimeAudio();
      });
    });
    api.onCharacterGeneration?.((payload) => updateGeneratorProgress(payload));
    $("#avatarImageInput").addEventListener("change", async (event) => {
      const file = event.target.files?.[0] || null;
      generatorFile = null;
      $("#avatarImageDrop").classList.remove("has-image");
      if (!file) {
        updateGeneratorProgress({ phase: "idle", message: "画像を選択してください。" });
        syncGeneratorUi();
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        updateGeneratorProgress({ phase: "error", message: "画像は15MB以下にしてください。" });
        syncGeneratorUi();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        $("#avatarImagePreview").src = String(reader.result || "");
        $("#avatarImageDrop").classList.add("has-image");
      };
      reader.readAsDataURL(file);
      generatorFile = file;
      updateGeneratorProgress({ phase: "ready", message: `${file.name} を使用します。` });
      syncGeneratorUi();
    });
    $("#avatarRightsConfirm").addEventListener("change", syncGeneratorUi);
    $("#generateCharacterButton").addEventListener("click", async () => {
      if (!generatorFile || generatorBusy) return;
      generatorBusy = true;
      syncGeneratorUi();
      updateGeneratorProgress({ phase: "start", message: "画像を読み込んでいます…" });
      try {
        const bytes = new Uint8Array(await generatorFile.arrayBuffer());
        state = await api.generateCharacter({
          bytes,
          fileName: generatorFile.name,
          mimeType: generatorFile.type,
          name: $("#generatedCharacterNameInput").value.trim(),
        });
        generatorFile = null;
        $("#avatarImageInput").value = "";
        $("#avatarRightsConfirm").checked = false;
        $("#avatarImageDrop").classList.remove("has-image");
        syncUi();
      } catch (error) {
        updateGeneratorProgress({ phase: "error", message: error.message });
      } finally {
        generatorBusy = false;
        syncGeneratorUi();
      }
    });
    $$(".nav-tab").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.page)));
    $("#chatForm").addEventListener("submit", (event) => { event.preventDefault(); sendChat(); });
    $("#chatInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); sendChat(); }
    });
    $("#micLipSyncButton").addEventListener("click", toggleLipSync);
    $("#speechInputButton").addEventListener("click", toggleSpeechInput);
    $$("[data-expression]").forEach((button) => button.addEventListener("click", () => {
      const expressions = {
        neutral: { forceMouth: 0, forceEyesClosed: false, durationMs: 1000 },
        happy: { forceMouth: 1, forceEyesClosed: false, emotion: "happy", durationMs: 1800 },
        surprised: { forceMouth: 2, forceEyesClosed: false, emotion: "surprised", durationMs: 1500 },
        soft: { forceMouth: 0, forceEyesClosed: false, emotion: "soft", durationMs: 2000 },
        sleepy: { forceMouth: 0, forceEyesClosed: true, durationMs: 2200 },
      };
      api.setExpression(expressions[button.dataset.expression]);
    }));
    $("#resetChatButton").addEventListener("click", async () => {
      await api.resetChat();
      $("#chatLog").replaceChildren();
      appendMessage("assistant", "新しい会話を始めよう。何を話す？");
    });
    $("#saveCharacterProfileButton").addEventListener("click", async () => {
      const character = currentCharacter();
      try {
        state = await api.configureCharacter({
          id: character.id,
          name: $("#characterNameInput").value,
          personality: $("#characterPersonalityInput").value,
          ui: {
            bubbleLeft: Number($("#bubbleLeftInput").value),
            bubbleTop: Number($("#bubbleTopInput").value),
            bubbleWidth: Number($("#bubbleWidthInput").value),
          },
          motion: currentMotionValues(),
        });
        syncUi();
        setStatus($("#characterProfileStatus"), "保存して会話へ反映しました。");
      } catch (error) {
        setStatus($("#characterProfileStatus"), error.message, true);
      }
    });
    $("#resetCharacterProfileButton").addEventListener("click", async () => {
      try {
        state = await api.configureCharacter({ id: currentCharacter().id, reset: true });
        syncUi();
        setStatus($("#characterProfileStatus"), "初期設定へ戻しました。");
      } catch (error) {
        setStatus($("#characterProfileStatus"), error.message, true);
      }
    });
    $$('input[name="backend"]').forEach((input) => input.addEventListener("change", async () => {
      if (input.checked && input.value !== "codex") await stopCodexRealtimeVoice({ quiet: true });
      await saveSettings();
    }));
    ["#alwaysOnTopToggle", "#clickThroughToggle", "#mouseFollowToggle", "#launchAtLoginToggle", "#ttsToggle", "#positionLockedToggle", "#edgeSnapToggle"]
      .forEach((selector) => $(selector).addEventListener("change", saveSettings));
    ["#openaiModelInput", "#transcriptionModelInput", "#codexModelInput"]
      .forEach((selector) => $(selector).addEventListener("change", saveSettings));
    $("#displaySelect").addEventListener("change", saveSettings);
    motionFields.forEach((key) => $(`#${key}Input`).addEventListener("input", () => {
      syncMotionReadouts();
      previewCharacterMotion();
      setStatus($("#characterProfileStatus"), "プレビュー中。保存すると次回起動後も反映されます。");
    }));
    $("#saveApiKeyButton").addEventListener("click", async () => {
      try {
        state = await api.setApiKey($("#apiKeyInput").value);
        $("#apiKeyInput").value = "";
        syncUi();
        setStatus($("#connectionStatus"), "APIキーを保存しました。");
      } catch (error) {
        setStatus($("#connectionStatus"), error.message, true);
      }
    });
    $("#testBackendButton").addEventListener("click", async () => {
      const backend = $("input[name='backend']:checked")?.value || state.backend;
      try {
        await saveSettings();
        setStatus($("#connectionStatus"), "接続を確認しています…");
        const result = await api.testBackend(backend);
        setStatus($("#connectionStatus"), result.message);
        if (backend === "codex") refreshCodexAccount();
      } catch (error) {
        setStatus($("#connectionStatus"), error.message, true);
      }
    });
    $("#codexLoginButton").addEventListener("click", async () => {
      try {
        if ($("#codexLoginButton").dataset.action === "logout") {
          if (!window.confirm("ChatGPTからログアウトします。Codex CLI全体のログインも解除されます。続けますか？")) return;
          $("#codexLoginButton").disabled = true;
          setStatus($("#connectionStatus"), "ChatGPTからログアウトしています…");
          await api.logoutCodex();
          await refreshCodexAccount();
          setStatus($("#connectionStatus"), "ChatGPTからログアウトしました。");
          return;
        }
        setStatus($("#connectionStatus"), "ChatGPTログインをブラウザで開いています…");
        await api.startCodexLogin();
        setStatus($("#connectionStatus"), "ブラウザでログインを完了してください。この画面で自動確認します。");
        waitForCodexLogin();
      } catch (error) {
        $("#codexLoginButton").disabled = false;
        setStatus($("#connectionStatus"), error.message, true);
      }
    });
    $("#onboardingLoginButton").addEventListener("click", async () => {
      try {
        if (codexAccount?.signedIn) return;
        $("#onboardingLoginButton").disabled = true;
        $("#onboardingAccountState").textContent = "ブラウザでログインを開始しています…";
        await api.startCodexLogin();
        $("#onboardingAccountState").textContent = "ブラウザでログインを完了してください。自動で確認します。";
        waitForCodexLogin();
      } catch (error) {
        $("#onboardingLoginButton").disabled = false;
        $("#onboardingAccountState").textContent = error.message;
      }
    });
    $("#onboardingBackButton").addEventListener("click", () => setOnboardingStep(onboardingStep - 1));
    $("#onboardingNextButton").addEventListener("click", async () => {
      if (onboardingStep < 2) setOnboardingStep(onboardingStep + 1);
      else await finishOnboarding();
    });
    $("#onboardingSkipButton").addEventListener("click", finishOnboarding);
    $("#onboardingOpenGeneratorButton").addEventListener("click", () => {
      $("#onboarding").hidden = true;
      showPage("character");
      setTimeout(() => $("#avatarGeneratorCard").scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    });
    $("#onboardingTtsToggle").addEventListener("change", async () => {
      $("#ttsToggle").checked = $("#onboardingTtsToggle").checked;
      await saveSettings();
    });
    $("#onboardingAudioTestButton").addEventListener("click", () => {
      if (!state.ttsEnabled) {
        $("#onboardingTtsToggle").checked = true;
        $("#ttsToggle").checked = true;
        saveSettings().then(() => speakResponse("音声テストです。これからよろしくね。"));
        return;
      }
      speakResponse("音声テストです。これからよろしくね。");
    });
    $("#reopenOnboardingButton").addEventListener("click", async () => {
      state = await api.completeOnboarding(false);
      onboardingStep = 0;
      syncOnboarding();
    });
    $("#showMascotButton").addEventListener("click", () => api.controlMascotWindow("show"));
    $("#hideMascotButton").addEventListener("click", () => api.controlMascotWindow("hide"));
    $("#sizeDownButton").addEventListener("click", () => api.controlMascotWindow("sizeDown"));
    $("#sizeUpButton").addEventListener("click", () => api.controlMascotWindow("sizeUp"));
    $("#resetPositionButton").addEventListener("click", () => api.controlMascotWindow("resetPosition"));
    document.addEventListener("visibilitychange", async () => {
      if (!document.hidden) {
        state = await api.getState();
        syncUi();
      }
    });
  }

  async function init() {
    if (!api) throw new Error("Electron bridge is unavailable");
    state = await api.getState();
    bindEvents();
    syncUi();
    refreshCodexAccount();
  }

  init().catch((error) => {
    setStatus($("#chatStatus"), `起動エラー: ${error.message}`, true);
    $("#connectionPill").classList.add("is-error");
    $("#connectionLabel").textContent = "起動エラー";
  });
})();
