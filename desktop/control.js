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
  let recordingProvider = "openai";
  let realtimePeerConnection = null;
  let realtimeDataChannel = null;
  let realtimeRemoteAudio = null;
  let realtimeStarting = false;
  let realtimeUserTranscript = "";
  let realtimeAssistantMessage = null;
  let realtimeUnavailable = false;
  let speechPulseTimer = null;
  let speechAudio = null;
  let speechPlaybackToken = 0;
  let streamingMessage = null;
  let generatorFile = null;
  let generatorBusy = false;
  let codexAccount = null;
  let codexModels = [];
  let onboardingStep = 0;
  let onboardingWasOpen = false;
  let onboardingFocusReturn = null;
  let motionPreviewTimer = 0;
  const motionFields = [
    "avatarSize", "rangeLeft", "rangeRight", "rangeUp", "rangeDown",
    "followSpeed", "breathStrength", "rollStrength", "pyokoStrength", "hairSpring", "hairWarp",
  ];

  function setStatus(element, message, error = false) {
    element.textContent = String(message || "");
    element.classList.toggle("is-error", Boolean(error));
  }

  function syncSherpaModelUi(model = {}) {
    const status = $("#sherpaModelStatus");
    const progress = $("#sherpaModelProgress");
    const download = $("#sherpaModelDownloadButton");
    const remove = $("#sherpaModelRemoveButton");
    const select = $("#sherpaModelSelect");
    const hint = $("#sherpaModelHint");
    if (!status || !progress || !download || !remove || !select || !hint) return;
    const models = Array.isArray(model.models) ? model.models : [];
    if (models.length) {
      select.replaceChildren(...models.map((item) => new Option(
        `${item.label}${item.recommended ? "（推奨）" : ""}${item.installed ? " · 導入済み" : ""}`,
        item.modelId,
      )));
      select.value = model.modelId || models[0].modelId;
    }
    const transfer = model.progress || {};
    const total = Number(transfer.totalBytes || model.downloadBytes) || 116_204_861;
    const received = Number(transfer.receivedBytes) || 0;
    if (model.downloading || transfer.phase === "downloading" || transfer.phase === "extracting") {
      progress.hidden = false;
      if (transfer.phase === "extracting") {
        progress.removeAttribute("value");
        status.textContent = "モデルを展開しています…";
      } else {
        const percent = Math.min(100, Math.round(received / total * 100));
        progress.value = percent;
        status.textContent = `モデルをダウンロードしています… ${percent}%`;
      }
    } else {
      progress.hidden = true;
      progress.value = 0;
      status.textContent = model.installed
        ? `${model.label || "日本語音声モデル"} · 利用できます`
        : "日本語音声モデルはまだダウンロードされていません。";
    }
    download.hidden = Boolean(model.installed);
    download.disabled = Boolean(model.downloading);
    remove.hidden = !model.installed;
    remove.disabled = Boolean(model.downloading);
    select.disabled = Boolean(model.downloading);
    const downloadMb = Math.max(1, Math.round(Number(model.downloadBytes || 0) / 1024 / 1024));
    download.textContent = `ダウンロード（約${downloadMb}MB）`;
    hint.textContent = `${model.description || "日本語音声認識モデル"}。初回ダウンロード約${downloadMb}MB。認識処理と音声データは端末内で完結します。`;
  }

  function setCodexModelOptions(select, selectedValue) {
    const value = String(selectedValue || "");
    select.replaceChildren(new Option("Codex既定", ""));
    for (const model of codexModels) {
      const option = new Option(`${model.displayName || model.model}${model.isDefault ? "（既定）" : ""}`, model.model);
      option.title = model.description || "";
      select.appendChild(option);
    }
    if (value && ![...select.options].some((option) => option.value === value)) {
      select.appendChild(new Option(`${value}（保存済み）`, value));
    }
    select.value = value;
  }

  async function refreshCodexModels() {
    try {
      const models = await api.getCodexModels();
      codexModels = Array.isArray(models) ? models.filter((model) => model?.model && !model.hidden) : [];
      setCodexModelOptions($("#codexChatModelInput"), state.codexChatModel || state.codexModel || "");
      setCodexModelOptions($("#codexWorkModelInput"), state.codexWorkModel || state.codexModel || "");
    } catch (error) {
      setCodexModelOptions($("#codexChatModelInput"), state.codexChatModel || state.codexModel || "");
      setCodexModelOptions($("#codexWorkModelInput"), state.codexWorkModel || state.codexModel || "");
      setStatus($("#connectionStatus"), `モデル一覧を取得できません: ${error.message}`, true);
    }
  }

  function showPage(name) {
    sessionStorage.setItem("purupet.activePage", name);
    $$(".nav-tab").forEach((button) => {
      const active = button.dataset.page === name;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    $$("[data-page-panel]").forEach((panel) => {
      const active = panel.dataset.pagePanel === name;
      panel.classList.toggle("is-active", active);
      panel.setAttribute("aria-hidden", String(!active));
    });
  }

  function appendMessage(role, text, thinking = false) {
    const article = document.createElement("article");
    article.className = `message is-${role}${thinking ? " is-thinking" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "message-avatar";
    const character = currentCharacter();
    avatar.textContent = role === "user" ? "YOU" : [...(character?.name || "AI")][0];
    const content = document.createElement("div");
    const label = document.createElement("small");
    label.textContent = role === "user" ? "あなた" : character?.name || "キャラクター";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    content.append(label, paragraph);
    article.append(avatar, content);
    $("#chatLog").appendChild(article);
    $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
    return article;
  }

  function showOptimisticCharacterSelection(characterId, selector) {
    $$(selector).forEach((item) => {
      const selected = item.dataset.characterId === characterId;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
  }

  function renderCharacters() {
    const grid = $("#characterGrid");
    grid.replaceChildren();
    for (const character of state.characters) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `character-card${character.id === state.characterId ? " is-active" : ""}`;
      button.dataset.characterId = character.id;
      button.setAttribute("aria-pressed", String(character.id === state.characterId));
      const image = document.createElement("img");
      image.src = character.thumbnailUrl;
      image.alt = `${character.name}のプレビュー`;
      const copy = document.createElement("span");
      copy.className = "character-card-copy";
      const name = document.createElement("strong");
      name.textContent = character.name;
      const summary = document.createElement("small");
      summary.textContent = String(character.personality || "会話スタイルを設定できます").split(/[。！!]/)[0];
      const selected = document.createElement("span");
      selected.className = "selected";
      selected.textContent = "✓";
      copy.append(name, summary);
      button.append(image, copy, selected);
      button.addEventListener("click", async () => {
        showOptimisticCharacterSelection(character.id, "#characterGrid .character-card");
        try {
          state = await api.setCharacter(character.id);
          renderCharacters();
          syncCharacterEditor();
          setStatus($("#chatStatus"), `${state.characters.find((item) => item.id === character.id)?.name || character.name}に切り替えました。`);
        } catch (error) {
          renderCharacters();
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
      button.dataset.characterId = character.id;
      button.setAttribute("aria-pressed", String(character.id === state.characterId));
      const image = document.createElement("img");
      image.src = character.thumbnailUrl;
      image.alt = `${character.name}のプレビュー`;
      const name = document.createElement("strong");
      name.textContent = character.name;
      button.append(image, name);
      button.addEventListener("click", async () => {
        showOptimisticCharacterSelection(character.id, "#onboardingCharacterGrid .onboarding-character");
        try {
          state = await api.setCharacter(character.id);
          renderCharacters();
          renderOnboardingCharacters();
          syncCharacterEditor();
          const legal = $(".onboarding-legal");
          legal.classList.remove("is-error");
          legal.textContent = "画像を追加する場合、その画像をアップロード・加工・利用する権利が必要です。生成処理では画像がCodexへ送信されます。";
        } catch (error) {
          renderOnboardingCharacters();
          const legal = $(".onboarding-legal");
          legal.textContent = `切り替えられませんでした: ${error.message}`;
          legal.classList.add("is-error");
        }
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
      const input = $(`#${key}Input`);
      const value = Number(input.value) || 0;
      const min = Number(input.min) || 0;
      const max = Number(input.max) || 100;
      input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, ((value - min) / Math.max(1, max - min)) * 100))}%`);
      $(`#${key}Output`).textContent = `${Math.round(value)}%`;
    }
  }

  function currentMotionValues() {
    return Object.fromEntries(motionFields.map((key) => [key, Number($(`#${key}Input`).value)]));
  }

  function previewCharacterMotion() {
    cancelAnimationFrame(motionPreviewTimer);
    motionPreviewTimer = requestAnimationFrame(() => {
      const character = currentCharacter();
      if (!character) return;
      api.previewCharacterMotion({ id: character.id, motion: currentMotionValues() }).catch((error) => {
        setStatus($("#characterProfileStatus"), error.message, true);
      });
    });
  }

  function setOnboardingStep(step) {
    const nextStep = Math.max(0, Math.min(2, Number(step) || 0));
    const modal = $(".onboarding-window");
    modal.dataset.stepDirection = nextStep < onboardingStep ? "back" : "forward";
    onboardingStep = nextStep;
    $$("[data-onboarding-step]").forEach((panel) => panel.classList.toggle("is-active", Number(panel.dataset.onboardingStep) === onboardingStep));
    $$(".onboarding-progress i").forEach((item, index) => {
      item.classList.toggle("is-active", index <= onboardingStep);
      if (index === onboardingStep) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    $("#onboardingBackButton").disabled = onboardingStep === 0;
    $("#onboardingStepLabel").textContent = `${onboardingStep + 1} / 3`;
    $("#onboardingNextButton").textContent = onboardingStep === 2 ? "セットアップ完了" : "次へ";
    requestAnimationFrame(() => {
      const heading = $(`[data-onboarding-step="${onboardingStep}"] h2`);
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
    });
  }

  function syncOnboarding() {
    const open = !state.onboardingComplete;
    const opening = open && !onboardingWasOpen;
    const onboarding = $("#onboarding");
    if (opening) onboardingFocusReturn = document.activeElement;
    onboarding.hidden = !open;
    $(".app-shell").inert = open;
    if (!open && onboardingWasOpen && onboardingFocusReturn?.focus) onboardingFocusReturn.focus({ preventScroll: true });
    onboardingWasOpen = open;
    $("#onboardingTtsToggle").checked = Boolean(state.ttsEnabled);
    renderOnboardingCharacters();
    if (opening) setOnboardingStep(onboardingStep);
  }

  async function finishOnboarding() {
    state = await api.completeOnboarding(true);
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
    document.documentElement.dataset.character = state.characterId || "amber-avatar";
    const sidebarCharacter = currentCharacter();
    if (sidebarCharacter) {
      $("#sidebarCharacterPreview").src = sidebarCharacter.thumbnailUrl;
      $("#initialAssistantLabel").textContent = sidebarCharacter.name;
      const initialAvatar = $("#chatLog .message.is-assistant .message-avatar");
      if (initialAvatar) initialAvatar.textContent = [...sidebarCharacter.name][0];
    }
    renderCharacters();
    syncCharacterEditor();
    syncGeneratorUi();
    const backend = $(`input[name="backend"][value="${state.backend}"]`);
    if (backend) backend.checked = true;
    $("#openaiModelInput").value = state.openaiModel || "";
    $("#transcriptionModelInput").value = state.transcriptionModel || "";
    setCodexModelOptions($("#codexChatModelInput"), state.codexChatModel || state.codexModel || "");
    $("#codexChatReasoningEffortSelect").value = state.codexChatReasoningEffort || "";
    setCodexModelOptions($("#codexWorkModelInput"), state.codexWorkModel || state.codexModel || "");
    $("#codexWorkReasoningEffortSelect").value = state.codexWorkReasoningEffort || "";
    $("#alwaysOnTopToggle").checked = Boolean(state.alwaysOnTop);
    $("#clickThroughToggle").checked = Boolean(state.clickThrough);
    $("#mouseFollowToggle").checked = Boolean(state.mouseFollow);
    $("#launchAtLoginToggle").checked = Boolean(state.launchAtLogin);
    $("#ttsToggle").checked = Boolean(state.ttsEnabled);
    $("#ttsProviderSelect").value = state.ttsProvider || "system";
    $("#styleBertVits2UrlInput").value = state.styleBertVits2Url || "http://localhost:5000";
    $("#styleBertVits2ModelIdInput").value = Number(state.styleBertVits2ModelId) || 0;
    $("#styleBertVits2SpeedInput").value = Number(state.styleBertVits2Speed) || 1;
    $("#styleBertVits2Settings").hidden = $("#ttsProviderSelect").value !== "style-bert-vits2";
    $("#englishPronunciationToggle").checked = state.englishPronunciationEnabled !== false;
    $("#englishPronunciationDictionaryInput").value = state.englishPronunciationDictionary || "";
    $("#speechInputProviderSelect").value = state.speechInputProvider || "auto";
    $("#sherpaOnnxSettings").hidden = $("#speechInputProviderSelect").value !== "sherpa-onnx";
    const recordedSpeechSelected = ["auto", "codex-audio", "sherpa-onnx", "openai"].includes($("#speechInputProviderSelect").value);
    $("#voiceActivationSettings").hidden = !recordedSpeechSelected;
    $("#voiceActivationModeSelect").value = state.voiceActivationMode || "vad";
    $("#vadSensitivitySelect").value = state.vadSensitivity || "normal";
    $("#voiceAutoSendToggle").checked = state.voiceAutoSend !== false;
    syncSherpaModelUi(state.sherpaModel);
    $("#positionLockedToggle").checked = Boolean(state.positionLocked);
    $("#edgeSnapToggle").checked = Boolean(state.edgeSnap);
    const displaySelect = $("#displaySelect");
    displaySelect.replaceChildren(new Option("自動（メインモニター）", ""));
    for (const display of state.displays || []) displaySelect.appendChild(new Option(display.label, display.id));
    displaySelect.value = state.preferredDisplayId || "";
    const voiceMode = $("#speechInputMode");
    const providerLabels = {
      auto: state.sherpaModel?.installed ? `自動 · ${state.sherpaModel.label || "日本語sherpa"}` : "自動 · 端末音声認識",
      realtime: "Codex Realtime · 実験的",
      "codex-audio": "Codex音声入力",
      "sherpa-onnx": "sherpa-onnx",
      browser: "端末音声認識",
      openai: "OpenAI文字起こし",
    };
    voiceMode.textContent = providerLabels[state.speechInputProvider || "auto"];
    voiceMode.classList.toggle("is-fallback", !["auto", "realtime"].includes(state.speechInputProvider || "auto"));
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
        await refreshCodexModels();
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
      codexChatModel: $("#codexChatModelInput").value.trim(),
      codexChatReasoningEffort: $("#codexChatReasoningEffortSelect").value,
      codexWorkModel: $("#codexWorkModelInput").value.trim(),
      codexWorkReasoningEffort: $("#codexWorkReasoningEffortSelect").value,
      alwaysOnTop: $("#alwaysOnTopToggle").checked,
      clickThrough: $("#clickThroughToggle").checked,
      mouseFollow: $("#mouseFollowToggle").checked,
      launchAtLogin: $("#launchAtLoginToggle").checked,
      ttsEnabled: $("#ttsToggle").checked,
      ttsProvider: $("#ttsProviderSelect").value,
      styleBertVits2Url: $("#styleBertVits2UrlInput").value.trim(),
      styleBertVits2ModelId: Number($("#styleBertVits2ModelIdInput").value),
      styleBertVits2Speed: Number($("#styleBertVits2SpeedInput").value),
      englishPronunciationEnabled: $("#englishPronunciationToggle").checked,
      englishPronunciationDictionary: $("#englishPronunciationDictionaryInput").value,
      speechInputProvider: $("#speechInputProviderSelect").value,
      sherpaModelId: $("#sherpaModelSelect").value || state?.sherpaModelId,
      speechLanguage: state?.speechLanguage || "ja-JP",
      voiceActivationMode: $("#voiceActivationModeSelect").value,
      vadSensitivity: $("#vadSensitivitySelect").value,
      voiceAutoSend: $("#voiceAutoSendToggle").checked,
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

  async function startFallbackSpeechInput(message = "端末音声認識へ切り替えました。") {
    $("#speechInputMode").textContent = "端末音声認識";
    $("#speechInputMode").classList.add("is-fallback");
    setStatus($("#chatStatus"), message, true);
    try {
      if (speechRecognition || mediaRecorder?.state === "recording") return true;
      if (startBrowserSpeechRecognition()) return true;
      await toggleRecordedSpeechInput();
      return true;
    } catch (error) {
      setStatus($("#chatStatus"), `音声入力を開始できません: ${error.message}`, true);
      return false;
    }
  }

  async function decodeRecordedAudio(blob) {
    audioContext ||= new AudioContext();
    await audioContext.resume();
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const samples = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const values = decoded.getChannelData(channel);
      for (let index = 0; index < values.length; index += 1) samples[index] += values[index] / decoded.numberOfChannels;
    }
    return { samples, sampleRate: Math.round(decoded.sampleRate) };
  }

  async function transcribeWithSherpaOnnx(blob) {
    const { samples, sampleRate } = await decodeRecordedAudio(blob);
    if (!samples.length) throw new Error("録音された音声が空です。");
    if (samples.byteLength > 60 * 1024 * 1024) throw new Error("録音が長すぎます。短く区切ってください。");
    return api.transcribeSherpa({ samples, sampleRate });
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
      realtimeUnavailable ||= Boolean(params.unavailable);
      closeRealtimeAudio();
      if ((state.speechInputProvider || "auto") === "realtime") {
        setStatus($("#chatStatus"), params.message || "Codex Realtime音声接続を開始できませんでした。", true);
      } else {
        await startFallbackSpeechInput(`${params.message || "Codex Realtime音声接続を開始できませんでした。"} 端末音声認識へ自動で切り替えます。`);
      }
      return;
    }
    if (method === "thread/realtime/closed") {
      closeRealtimeAudio();
      setStatus($("#chatStatus"), "Codex Realtime音声入力を終了しました。");
    }
  }

  async function toggleRecordedSpeechInput(provider = "openai") {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.stop();
      return;
    }
    const stream = await ensureAudioStream();
    recordedChunks = [];
    recordingProvider = provider;
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordedChunks.push(event.data); };
    mediaRecorder.onstop = async () => {
      $("#speechInputButton").setAttribute("aria-pressed", "false");
      try {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        if (recordingProvider === "codex-audio") {
          setStatus($("#chatStatus"), "Codexへ音声を送信しています…");
          appendMessage("user", "🎙 音声メッセージ");
          const thinking = appendMessage("assistant", "考え中", true);
          streamingMessage = thinking;
          setChatBusy(true);
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const result = await api.sendCodexAudio({ bytes, mimeType: blob.type });
          thinking.classList.remove("is-thinking");
          thinking.querySelector("p").textContent = result.displayText || result.text;
          setStatus($("#chatStatus"), "Codexが音声へ応答しました。");
        } else if (recordingProvider === "sherpa-onnx") {
          setStatus($("#chatStatus"), "sherpa-onnxで音声を文字にしています…");
          $("#chatInput").value = await transcribeWithSherpaOnnx(blob);
        } else {
          setStatus($("#chatStatus"), "OpenAIで音声を文字にしています…");
          const bytes = new Uint8Array(await blob.arrayBuffer());
          $("#chatInput").value = await api.transcribe({ bytes, mimeType: blob.type });
        }
        if (recordingProvider !== "codex-audio") setStatus($("#chatStatus"), "音声を入力欄へ追加しました。");
      } catch (error) {
        setStatus($("#chatStatus"), error.message, true);
      } finally {
        setChatBusy(false);
        streamingMessage = null;
      }
    };
    mediaRecorder.start();
    $("#speechInputButton").setAttribute("aria-pressed", "true");
    setStatus($("#chatStatus"), provider === "codex-audio"
      ? "Codex音声入力を録音中…もう一度押すと送信します。"
      : `${provider === "sherpa-onnx" ? "sherpa-onnx用に" : ""}録音中…もう一度押すと文字に変換します。`);
  }

  async function toggleSpeechInput() {
    if (speechRecognition) {
      speechRecognition.stop();
      return;
    }
    if (mediaRecorder?.state === "recording") {
      await toggleRecordedSpeechInput();
      return;
    }
    if (realtimePeerConnection || realtimeStarting) {
      await stopCodexRealtimeVoice();
      return;
    }
    let provider = state.speechInputProvider || "auto";
    if (provider === "auto") provider = state.sherpaModel?.installed ? "sherpa-onnx" : "browser";
    if (provider === "browser") {
      if (!startBrowserSpeechRecognition()) setStatus($("#chatStatus"), "この端末では音声認識を利用できません。", true);
      return;
    }
    if (provider === "sherpa-onnx") {
      await toggleRecordedSpeechInput("sherpa-onnx");
      return;
    }
    if (provider === "codex-audio") {
      if (state.backend !== "codex") {
        setStatus($("#chatStatus"), "Codex音声入力はCodex接続時のみ利用できます。", true);
        return;
      }
      await toggleRecordedSpeechInput("codex-audio");
      return;
    }
    if (provider === "openai") {
      await toggleRecordedSpeechInput("openai");
      return;
    }
    if (provider === "realtime" && state.backend !== "codex") {
      setStatus($("#chatStatus"), "Codex RealtimeはCodex app-server接続時のみ利用できます。", true);
      return;
    }
    if (provider === "realtime" && state.backend === "codex" && !realtimeUnavailable) {
      try {
        await startCodexRealtimeVoice();
        return;
      } catch (error) {
        api.stopCodexRealtime().catch(() => {});
        closeRealtimeAudio();
        realtimeUnavailable ||= /まだ提供されていません/.test(error.message);
        setStatus($("#chatStatus"), `Codex Realtimeを利用できません: ${error.message}`, true);
        return;
      }
    }
    if (provider === "realtime") {
      setStatus($("#chatStatus"), "Codex Realtimeは現在利用できません。設定から別の認識方式を選んでください。", true);
      return;
    }
    await startFallbackSpeechInput("端末音声認識を使います。");
  }

  function stopSpeechPulse() {
    clearInterval(speechPulseTimer);
    speechPulseTimer = null;
    api.sendVoiceLevel(0).catch(() => {});
  }

  function stopSpeechPlayback() {
    speechPlaybackToken += 1;
    window.speechSynthesis?.cancel();
    if (speechAudio) {
      speechAudio.pause();
      speechAudio.src = "";
      speechAudio = null;
    }
    stopSpeechPulse();
  }

  function playGeneratedAudio(source, token) {
    return new Promise((resolve, reject) => {
      if (token !== speechPlaybackToken) return resolve();
      speechAudio = new Audio(source);
      speechAudio.preload = "auto";
      speechAudio.onplay = () => {
        let phase = 0;
        clearInterval(speechPulseTimer);
        speechPulseTimer = setInterval(() => {
          phase += .8;
          api.sendVoiceLevel(.12 + Math.abs(Math.sin(phase)) * .28).catch(() => {});
        }, 80);
      };
      speechAudio.onended = resolve;
      speechAudio.onerror = () => {
        const detail = ({ 1: "再生が中断されました", 2: "音声データを読み込めません", 3: "音声形式をデコードできません", 4: "音声形式に対応していません" })[speechAudio.error?.code];
        reject(new Error(`生成した音声を再生できません${detail ? `（${detail}）` : ""}。`));
      };
      speechAudio.play().catch(reject);
    });
  }

  async function speakResponse(text) {
    if (!state.ttsEnabled) return;
    stopSpeechPlayback();
    const token = speechPlaybackToken;
    if (state.ttsProvider === "style-bert-vits2") {
      try {
        setStatus($("#ttsStatus"), "Style-Bert-VITS2で生成しています…");
        const result = await api.synthesizeTts(text);
        for (const source of result?.audioDataUrls || []) await playGeneratedAudio(source, token);
        if (token === speechPlaybackToken) setStatus($("#ttsStatus"), "接続と再生を確認しました。");
      } catch (error) {
        if (token === speechPlaybackToken) setStatus($("#ttsStatus"), error.message, true);
      } finally {
        if (token === speechPlaybackToken) {
          speechAudio = null;
          stopSpeechPulse();
        }
      }
      return;
    }
    if (!window.speechSynthesis) return;
    const spokenText = await api.normalizeTtsText(text).catch(() => text);
    const utterance = new SpeechSynthesisUtterance(spokenText);
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

  function setChatBusy(busy) {
    $("#sendButton").disabled = Boolean(busy);
    $("#sendButton").hidden = Boolean(busy);
    $("#stopButton").hidden = !busy;
    $("#stopButton").disabled = false;
  }

  async function sendChat() {
    const input = $("#chatInput");
    if ($("#sendButton").disabled) return;
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    appendMessage("user", message);
    const thinking = appendMessage("assistant", "考え中", true);
    streamingMessage = thinking;
    setChatBusy(true);
    setStatus($("#chatStatus"), "応答を待っています…");
    try {
      const result = await api.sendChat(message);
      const paragraph = thinking.querySelector("p");
      thinking.classList.remove("is-thinking");
      paragraph.textContent = result.displayText || result.text;
      setStatus($("#chatStatus"), result.provider === "codex" ? "Codexから応答しました。" : "OpenAI APIから応答しました。");
    } catch (error) {
      thinking.classList.remove("is-thinking");
      const interrupted = /interrupt|cancel|abort|中断/i.test(String(error.message || ""));
      thinking.querySelector("p").textContent = interrupted ? "応答を中断しました。続けて修正できます。" : `エラー: ${error.message}`;
      setStatus($("#chatStatus"), interrupted ? "応答を中断しました。" : error.message, !interrupted);
    } finally {
      setChatBusy(false);
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
        paragraph.textContent = String(payload.displayText || payload.text || "");
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
    $$(".nav-tab").forEach((button) => {
      button.addEventListener("click", () => showPage(button.dataset.page));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const tabs = $$(".nav-tab");
        const current = tabs.indexOf(button);
        const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[index].focus();
        tabs[index].click();
      });
    });
    $("#chatForm").addEventListener("submit", (event) => { event.preventDefault(); sendChat(); });
    $("#stopButton").addEventListener("click", async () => {
      const button = $("#stopButton");
      button.disabled = true;
      setStatus($("#chatStatus"), "中断しています…");
      try {
        await api.interruptChat();
      } catch (error) {
        button.disabled = false;
        setStatus($("#chatStatus"), error.message, true);
      }
    });
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
      $$("[data-expression]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      setTimeout(() => button.setAttribute("aria-pressed", "false"), expressions[button.dataset.expression].durationMs);
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
    ["#alwaysOnTopToggle", "#clickThroughToggle", "#launchAtLoginToggle", "#ttsToggle", "#englishPronunciationToggle", "#positionLockedToggle", "#edgeSnapToggle"]
      .forEach((selector) => $(selector).addEventListener("change", saveSettings));
    $("#ttsProviderSelect").addEventListener("change", () => {
      $("#styleBertVits2Settings").hidden = $("#ttsProviderSelect").value !== "style-bert-vits2";
      if (!$("#styleBertVits2Settings").hidden) {
        setTimeout(() => {
          const scroller = $(".main-panel");
          const container = $("#ttsProviderSelect").closest(".tts-settings");
          const overflow = container.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom + 24;
          if (overflow > 0) scroller.scrollBy({
            top: overflow,
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          });
        }, 30);
      }
      saveSettings().catch((error) => setStatus($("#ttsStatus"), error.message, true));
    });
    $("#speechInputProviderSelect").addEventListener("change", () => {
      $("#sherpaOnnxSettings").hidden = $("#speechInputProviderSelect").value !== "sherpa-onnx";
      $("#voiceActivationSettings").hidden = !["auto", "codex-audio", "sherpa-onnx", "openai"].includes($("#speechInputProviderSelect").value);
      saveSettings().catch((error) => setStatus($("#connectionStatus"), error.message, true));
    });
    $("#sherpaModelSelect").addEventListener("change", () => {
      saveSettings().catch((error) => setStatus($("#ttsStatus"), error.message, true));
    });
    ["#voiceActivationModeSelect", "#vadSensitivitySelect", "#voiceAutoSendToggle"].forEach((selector) => $(selector).addEventListener("change", () => {
      saveSettings().catch((error) => setStatus($("#connectionStatus"), error.message, true));
    }));
    $("#sherpaModelDownloadButton").addEventListener("click", async () => {
      try {
        syncSherpaModelUi({ ...(state.sherpaModel || {}), downloading: true, progress: { phase: "downloading", receivedBytes: 0, totalBytes: state.sherpaModel?.downloadBytes || 116204861 } });
        state.sherpaModel = await api.downloadSherpaModel($("#sherpaModelSelect").value);
        syncSherpaModelUi(state.sherpaModel);
      } catch (error) {
        syncSherpaModelUi(state.sherpaModel);
        setStatus($("#ttsStatus"), error.message, true);
      }
    });
    $("#sherpaModelRemoveButton").addEventListener("click", async () => {
      if (!window.confirm(`${state.sherpaModel?.label || "ダウンロード済みのsherpa-onnx音声モデル"}を削除しますか？`)) return;
      state.sherpaModel = await api.removeSherpaModel($("#sherpaModelSelect").value);
      syncSherpaModelUi(state.sherpaModel);
    });
    ["#styleBertVits2UrlInput", "#styleBertVits2ModelIdInput", "#styleBertVits2SpeedInput", "#englishPronunciationDictionaryInput"]
      .forEach((selector) => $(selector).addEventListener("change", () => {
        saveSettings().catch((error) => setStatus($("#ttsStatus"), error.message, true));
      }));
    $("#ttsTestButton").addEventListener("click", async () => {
      try {
        await saveSettings();
        await speakResponse("音声テストです。これからよろしくね。");
      } catch (error) {
        setStatus($("#ttsStatus"), error.message, true);
      }
    });
    $("#mouseFollowToggle").addEventListener("change", () => {
      sessionStorage.setItem("purupet.activePage", "character");
      sessionStorage.setItem("purupet.characterScroll", String(document.scrollingElement?.scrollTop || 0));
      saveSettings().catch((error) => setStatus($("#characterProfileStatus"), error.message, true));
    });
    ["#openaiModelInput", "#transcriptionModelInput", "#codexChatModelInput", "#codexChatReasoningEffortSelect", "#codexWorkModelInput", "#codexWorkReasoningEffortSelect"]
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
        if (backend === "codex") {
          refreshCodexAccount();
          refreshCodexModels();
        }
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
    $("#onboardingOpenGeneratorButton").addEventListener("click", async () => {
      state = await api.completeOnboarding(true);
      syncOnboarding();
      showPage("character");
      setTimeout(() => $("#avatarGeneratorCard").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 30);
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
    $("#onboarding").addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishOnboarding();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = $$("#onboarding button:not(:disabled), #onboarding input:not(:disabled), #onboarding [tabindex='0']").filter((item) => item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
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
    api.onSherpaModelProgress((model) => {
      state.sherpaModel = model;
      syncSherpaModelUi(model);
    });
    bindEvents();
    syncUi();
    const page = sessionStorage.getItem("purupet.activePage") || "chat";
    showPage(["chat", "character", "connection", "desktop"].includes(page) ? page : "chat");
    if (page === "character") requestAnimationFrame(() => {
      document.scrollingElement.scrollTop = Number(sessionStorage.getItem("purupet.characterScroll")) || 0;
    });
    refreshCodexAccount();
    refreshCodexModels();
  }

  init().catch((error) => {
    setStatus($("#chatStatus"), `起動エラー: ${error.message}`, true);
    $("#connectionPill").classList.add("is-error");
    $("#connectionLabel").textContent = "起動エラー";
  });
})();
