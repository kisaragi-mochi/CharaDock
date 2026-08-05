# CharaDock Beatrice host

This is a minimal headless VST3 host used to process CharaDock's Codex Realtime audio through the official Beatrice 2 VST3 plug-in. It does not contain or redistribute Beatrice, its inference library, or any voice model.

The process receives length-prefixed mono Float32 PCM frames on stdin and returns length-prefixed Float32 PCM frames on stdout. Runtime status and errors are written to stderr.

Build requirements:

- CMake 3.25+
- a Windows C++20 compiler
- the MIT-licensed Steinberg VST3 SDK

```powershell
cmake -S native/beatrice-host -B build/beatrice-host -DVST3_SDK_ROOT=C:\src\vst3sdk
cmake --build build/beatrice-host --config Release
```

At runtime pass the installed official `.vst3` package and a compatible model TOML:

```powershell
charadock-beatrice-host.exe --plugin C:\Beatrice\beatrice_2.0.0-rc.2.vst3 --model C:\Beatrice\model\model.toml --voice 0 --pitch-shift 0 --formant-shift 0 --input-gain 0 --output-gain 0 --intonation 1 --pitch-correction 0 --pitch-correction-type 0
```

The optional tuning arguments use the parameter IDs and ranges published by
Beatrice's VST parameter schema. CharaDock supplies all arguments when it starts
the helper, so end users configure these values in the app rather than on the
command line.
