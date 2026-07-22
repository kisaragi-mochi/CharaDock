// SPDX-License-Identifier: Apache-2.0
const { execFile } = require("node:child_process");

const ALLOWED_KEYS = new Set([
  "CTRL", "ALT", "SHIFT", "WIN", "ENTER", "TAB", "ESC", "SPACE", "BACKSPACE", "DELETE",
  "UP", "DOWN", "LEFT", "RIGHT", "HOME", "END", "PAGEUP", "PAGEDOWN",
  "A", "C", "V", "X", "Z", "F4", "F5",
]);

function normalizedComputerInput(action, raw = {}) {
  const args = raw && typeof raw === "object" ? raw : {};
  if (action === "click") {
    const x = Math.round(Number(args.x));
    const y = Math.round(Number(args.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("クリック座標が正しくありません。");
    return { action, x, y, button: ["left", "right"].includes(args.button) ? args.button : "left", clicks: Number(args.clicks) === 2 ? 2 : 1 };
  }
  if (action === "scroll") {
    const x = Math.round(Number(args.x));
    const y = Math.round(Number(args.y));
    const delta = Math.max(-1200, Math.min(1200, Math.round(Number(args.delta) || 0)));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !delta) throw new Error("スクロール位置または量が正しくありません。");
    return { action, x, y, delta };
  }
  if (action === "type") {
    const text = String(args.text || "").slice(0, 2000);
    if (!text) throw new Error("入力する文字がありません。");
    return { action, text };
  }
  if (action === "key") {
    const keys = (Array.isArray(args.keys) ? args.keys : []).map((key) => String(key || "").toUpperCase()).filter(Boolean);
    if (!keys.length || keys.length > 4 || keys.some((key) => !ALLOWED_KEYS.has(key))) throw new Error("未対応のキー操作です。");
    return { action, keys };
  }
  throw new Error(`未対応のWindows入力です: ${action}`);
}

function windowsInputScript(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return `
$ErrorActionPreference = 'Stop'
$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class PuruPetInput {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public UInt32 type; public InputUnion U; }
  [StructLayout(LayoutKind.Explicit)] public struct InputUnion { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public Int32 dx; public Int32 dy; public UInt32 mouseData; public UInt32 dwFlags; public UInt32 time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public UInt16 wVk; public UInt16 wScan; public UInt32 dwFlags; public UInt32 time; public IntPtr dwExtraInfo; }
  [DllImport("user32.dll")] static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] static extern void mouse_event(UInt32 flags, UInt32 dx, UInt32 dy, UInt32 data, UIntPtr extraInfo);
  [DllImport("user32.dll", SetLastError=true)] static extern UInt32 SendInput(UInt32 count, INPUT[] inputs, Int32 size);
  static readonly Dictionary<string, UInt16> Keys = new Dictionary<string, UInt16>(StringComparer.OrdinalIgnoreCase) {
    {"CTRL",0x11},{"ALT",0x12},{"SHIFT",0x10},{"WIN",0x5B},{"ENTER",0x0D},{"TAB",0x09},{"ESC",0x1B},{"SPACE",0x20},{"BACKSPACE",0x08},{"DELETE",0x2E},
    {"UP",0x26},{"DOWN",0x28},{"LEFT",0x25},{"RIGHT",0x27},{"HOME",0x24},{"END",0x23},{"PAGEUP",0x21},{"PAGEDOWN",0x22},
    {"A",0x41},{"C",0x43},{"V",0x56},{"X",0x58},{"Z",0x5A},{"F4",0x73},{"F5",0x74}
  };
  static INPUT Key(UInt16 vk, UInt16 scan, UInt32 flags) { return new INPUT { type=1, U=new InputUnion { ki=new KEYBDINPUT { wVk=vk, wScan=scan, dwFlags=flags } } }; }
  public static void Click(int x, int y, string button, int clicks) { SetCursorPos(x,y); UInt32 down=button=="right"?0x0008u:0x0002u, up=button=="right"?0x0010u:0x0004u; for(int i=0;i<clicks;i++){ mouse_event(down,0,0,0,UIntPtr.Zero); mouse_event(up,0,0,0,UIntPtr.Zero); } }
  public static void Scroll(int x, int y, int delta) { SetCursorPos(x,y); mouse_event(0x0800u,0,0,unchecked((UInt32)delta),UIntPtr.Zero); }
  public static void TypeText(string text) { foreach(char ch in text) { var inputs=new[]{Key(0,ch,0x0004u),Key(0,ch,0x0006u)}; if(SendInput(2,inputs,Marshal.SizeOf(typeof(INPUT)))!=2) throw new InvalidOperationException("SendInput failed"); } }
  public static void Hotkey(string[] names) { var down=new List<INPUT>(); foreach(var name in names) down.Add(Key(Keys[name],0,0)); var all=new List<INPUT>(down); for(int i=down.Count-1;i>=0;i--) all.Add(Key(down[i].U.ki.wVk,0,0x0002u)); if(SendInput((UInt32)all.Count,all.ToArray(),Marshal.SizeOf(typeof(INPUT)))!=all.Count) throw new InvalidOperationException("SendInput failed"); }
}
'@
switch ($payload.action) {
  'click' { [PuruPetInput]::Click([int]$payload.x,[int]$payload.y,[string]$payload.button,[int]$payload.clicks) }
  'scroll' { [PuruPetInput]::Scroll([int]$payload.x,[int]$payload.y,[int]$payload.delta) }
  'type' { [PuruPetInput]::TypeText([string]$payload.text) }
  'key' { [PuruPetInput]::Hotkey([string[]]$payload.keys) }
  default { throw 'Unsupported input action' }
}
`;
}

function runWindowsInput(action, args, { platform = process.platform } = {}) {
  if (platform !== "win32") return Promise.reject(new Error("コンピューター操作はWindows版でのみ利用できます。"));
  const payload = normalizedComputerInput(action, args);
  return new Promise((resolve, reject) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", windowsInputScript(payload)], { windowsHide: true, timeout: 12_000, maxBuffer: 256 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`Windows操作に失敗しました: ${String(stderr || error.message).trim()}`));
      else resolve(true);
    });
  });
}

module.exports = { ALLOWED_KEYS, normalizedComputerInput, runWindowsInput, windowsInputScript };
