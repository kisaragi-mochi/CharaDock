// SPDX-License-Identifier: Apache-2.0

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function sherpaOnnxEndpoint(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || "ws://localhost:6006")); } catch {
    throw new Error("sherpa-onnxのWebSocket URLが正しくありません。");
  }
  if (url.protocol !== "ws:" || !LOCAL_HOSTS.has(url.hostname) || url.username || url.password) {
    throw new Error("sherpa-onnxにはlocalhostのws:// URLを指定してください。");
  }
  url.hash = "";
  return url;
}

module.exports = { sherpaOnnxEndpoint };
