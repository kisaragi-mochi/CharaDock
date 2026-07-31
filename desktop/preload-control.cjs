// SPDX-License-Identifier: Apache-2.0
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("mascotDesktop", {
  getState: () => ipcRenderer.invoke("app:getState"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  setApiKey: (key) => ipcRenderer.invoke("settings:setApiKey", key),
  setCharacter: (id) => ipcRenderer.invoke("character:set", id),
  removeCharacter: (id) => ipcRenderer.invoke("character:remove", id),
  removeMemory: (id) => ipcRenderer.invoke("memory:remove", id),
  clearMemories: () => ipcRenderer.invoke("memory:clear"),
  configureCharacter: (profile) => ipcRenderer.invoke("character:configure", profile),
  previewCharacterMotion: (payload) => ipcRenderer.invoke("character:previewMotion", payload),
  generateCharacter: (payload) => ipcRenderer.invoke("character:generate", payload),
  importPuruPuruCharacter: (payload) => ipcRenderer.invoke("character:importPuruPuru", payload),
  sendVoiceLevel: (level) => ipcRenderer.invoke("mascot:voice", level),
  setExpression: (expression) => ipcRenderer.invoke("mascot:expression", expression),
  controlMascotWindow: (action, value) => ipcRenderer.invoke("mascot:window", action, value),
  sendChat: (message) => ipcRenderer.invoke("chat:send", message),
  interruptChat: () => ipcRenderer.invoke("chat:interrupt"),
  resetChat: () => ipcRenderer.invoke("chat:reset"),
  getWorkHistory: () => ipcRenderer.invoke("work:getHistory"),
  chooseWorkDirectory: () => ipcRenderer.invoke("work:chooseDirectory"),
  openWorkDirectory: () => ipcRenderer.invoke("work:openDirectory"),
  openWorkArtifact: (payload) => ipcRenderer.invoke("work:openArtifact", payload),
  testBackend: (backend) => ipcRenderer.invoke("backend:test", backend),
  getCodexAccount: () => ipcRenderer.invoke("codex:account"),
  getCodexModels: () => ipcRenderer.invoke("codex:models"),
  getRealtimeVoices: () => ipcRenderer.invoke("codex:realtimeVoices"),
  startCodexLogin: () => ipcRenderer.invoke("codex:login"),
  logoutCodex: () => ipcRenderer.invoke("codex:logout"),
  completeOnboarding: (complete) => ipcRenderer.invoke("onboarding:complete", complete),
  getDiagnostics: () => ipcRenderer.invoke("support:getDiagnostics"),
  copyDiagnostics: () => ipcRenderer.invoke("support:copyDiagnostics"),
  exportSupportBundle: () => ipcRenderer.invoke("support:exportBundle"),
  openLogs: () => ipcRenderer.invoke("support:openLogs"),
  transcribe: (payload) => ipcRenderer.invoke("audio:transcribe", payload),
  transcribeSherpa: (payload) => ipcRenderer.invoke("audio:transcribeSherpa", payload),
  downloadSherpaModel: (modelId) => ipcRenderer.invoke("sherpa:modelDownload", modelId),
  removeSherpaModel: (modelId) => ipcRenderer.invoke("sherpa:modelRemove", modelId),
  synthesizeTts: (text) => ipcRenderer.invoke("tts:synthesize", text),
  nextTtsChunk: (streamId) => ipcRenderer.invoke("tts:nextChunk", streamId),
  cancelTtsStream: (streamId) => ipcRenderer.invoke("tts:cancelStream", streamId),
  downloadTtsModel: (provider) => ipcRenderer.invoke("tts:modelDownload", provider),
  removeTtsModel: (provider) => ipcRenderer.invoke("tts:modelRemove", provider),
  choosePiperPlusExecutable: () => ipcRenderer.invoke("tts:piperChooseExecutable"),
  choosePiperPlusModel: () => ipcRenderer.invoke("tts:piperChooseModel"),
  chooseSupertonicModel: () => ipcRenderer.invoke("tts:supertonicChooseModel"),
  chooseIrodoriModel: () => ipcRenderer.invoke("tts:irodoriChooseModel"),
  chooseIrodoriReference: () => ipcRenderer.invoke("tts:irodoriChooseReference"),
  selectIrodoriVoice: (id) => ipcRenderer.invoke("tts:irodoriSelectVoice", id),
  renameIrodoriVoice: (payload) => ipcRenderer.invoke("tts:irodoriRenameVoice", payload),
  removeIrodoriVoice: (id) => ipcRenderer.invoke("tts:irodoriRemoveVoice", id),
  normalizeTtsText: (text) => ipcRenderer.invoke("tts:normalizeText", text),
  startCodexRealtime: (payload) => ipcRenderer.invoke("audio:realtimeStart", payload),
  appendCodexRealtimeSpeech: (text) => ipcRenderer.invoke("audio:realtimeAppendSpeech", text),
  stopCodexRealtime: () => ipcRenderer.invoke("audio:realtimeStop"),
  onChatStream: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("chat:stream", listener);
    return () => ipcRenderer.removeListener("chat:stream", listener);
  },
  onChatHistory: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("chat:history", listener);
    return () => ipcRenderer.removeListener("chat:history", listener);
  },
  onWorkHistory: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("work:history", listener);
    return () => ipcRenderer.removeListener("work:history", listener);
  },
  onCharacterGeneration: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("character:generation", listener);
    return () => ipcRenderer.removeListener("character:generation", listener);
  },
  onStateChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("app:stateChanged", listener);
    return () => ipcRenderer.removeListener("app:stateChanged", listener);
  },
  onCodexRealtime: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("audio:realtimeEvent", listener);
    return () => ipcRenderer.removeListener("audio:realtimeEvent", listener);
  },
  onSherpaModelProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("sherpa:modelProgress", listener);
    return () => ipcRenderer.removeListener("sherpa:modelProgress", listener);
  },
  onTtsModelProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("tts:modelProgress", listener);
    return () => ipcRenderer.removeListener("tts:modelProgress", listener);
  },
});
