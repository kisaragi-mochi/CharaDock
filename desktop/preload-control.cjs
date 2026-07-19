// SPDX-License-Identifier: Apache-2.0
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mascotDesktop", {
  getState: () => ipcRenderer.invoke("app:getState"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  setApiKey: (key) => ipcRenderer.invoke("settings:setApiKey", key),
  setCharacter: (id) => ipcRenderer.invoke("character:set", id),
  configureCharacter: (profile) => ipcRenderer.invoke("character:configure", profile),
  previewCharacterMotion: (payload) => ipcRenderer.invoke("character:previewMotion", payload),
  generateCharacter: (payload) => ipcRenderer.invoke("character:generate", payload),
  sendVoiceLevel: (level) => ipcRenderer.invoke("mascot:voice", level),
  setExpression: (expression) => ipcRenderer.invoke("mascot:expression", expression),
  controlMascotWindow: (action, value) => ipcRenderer.invoke("mascot:window", action, value),
  sendChat: (message) => ipcRenderer.invoke("chat:send", message),
  resetChat: () => ipcRenderer.invoke("chat:reset"),
  testBackend: (backend) => ipcRenderer.invoke("backend:test", backend),
  getCodexAccount: () => ipcRenderer.invoke("codex:account"),
  startCodexLogin: () => ipcRenderer.invoke("codex:login"),
  logoutCodex: () => ipcRenderer.invoke("codex:logout"),
  completeOnboarding: (complete) => ipcRenderer.invoke("onboarding:complete", complete),
  transcribe: (payload) => ipcRenderer.invoke("audio:transcribe", payload),
  synthesizeTts: (text) => ipcRenderer.invoke("tts:synthesize", text),
  startCodexRealtime: (payload) => ipcRenderer.invoke("audio:realtimeStart", payload),
  stopCodexRealtime: () => ipcRenderer.invoke("audio:realtimeStop"),
  onChatStream: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("chat:stream", listener);
    return () => ipcRenderer.removeListener("chat:stream", listener);
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
});
