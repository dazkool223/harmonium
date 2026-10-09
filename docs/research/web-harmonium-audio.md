# Research: a low-latency web harmonium with swappable instruments

Researched 2026-10-09 from primary sources (specs, MDN, vendor docs, GitHub, npm). Points marked **[unverified]** came from general knowledge and were not checked against a fetched source.

## 1. Latency in Web Audio

- **`latencyHint`.** Pass it to `new AudioContext({latencyHint})`. Accepted values are `"interactive"` (the default), `"balanced"`, `"playback"`, or a number of seconds. The spec defines `"interactive"` as "the lowest audio output latency possible without glitching". The browser may ignore a numeric hint, so read `baseLatency` afterwards. Sources: https://webaudio.github.io/web-audio-api/, https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext
- **`baseLatency` and `outputLatency`.** `baseLatency` is the latency of the browser's own processing. `outputLatency` estimates the time from the OS to the speaker. `outputLatency` support: Chrome/Edge 102, Firefox 70, Safari 18.4 (MDN marks it Baseline 2025). Sources: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency, https://web.dev/articles/audio-output-latency
- **Bluetooth.** The Chromium intent-to-ship thread for `outputLatency` notes that values above about 150 ms usually mean a Bluetooth headset. Source: https://groups.google.com/a/chromium.org/g/blink-dev/c/dTQniJNVVMY
- **Autoplay policy.** An `AudioContext` created before any user gesture starts out `suspended`, so call `resume()` inside a gesture handler. Source: https://developer.chrome.com/blog/autoplay
- **Note triggering.** Trigger live notes with `start(0)` and no look-ahead. One `AudioBufferSourceNode` plus one `GainNode` per voice runs on the audio thread and supports sample loops. An AudioWorklet does not lower trigger latency. It is only needed for WASM engines and custom DSP. Source: https://developer.chrome.com/blog/audio-worklet
- **Keyboard events.** Use `event.code` (the physical key position, independent of layout) and ignore auto-repeat with `event.repeat`. Source: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat

## 2. Velocity

- **Keyboard.** `KeyboardEvent` has no pressure or velocity field.
- **Pointer pressure.** `PointerEvent.pressure` ranges from 0 to 1. On hardware without pressure sensing it reads **0.5 while a button is down**, so a mouse carries no dynamics. Pens and some touch screens report real values. Source: https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pressure
- **Web MIDI.** Note-on is `[0x9n, note, velocity]`. It needs a secure context and a permission prompt. Chromium supports it. WebKit has decided not to implement it, citing fingerprinting. Sources: https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API, https://webkit.org/tracking-prevention/
- **Velocity from a computer keyboard in other apps.**
  - Ableton Live: C/V step velocity by 20, Z/X shift the octave. Source: https://www.ableton.com/en/live-manual/12/routing-and-i-o/
  - AudioKeys: number keys set velocity. Source: https://github.com/kylestetz/AudioKeys

## 3. The harmonium

- **How it works.** It has free brass reeds in 1–3 banks. Hand-pumped bellows fill a reservoir, so the tone is **continuously sustained**. Loudness comes from bellows pressure, not from how hard a key is struck. Instruments have stops, drones and octave couplers, and 42 keys is standard (39 or 32 on smaller models). Source: https://en.wikipedia.org/wiki/Indian_harmonium (secondary source)
- **Samples.**
  - Freesound #330410 by donyaquick: every key plus the drones, recorded at Yale's Euterpea Studio, **CC0**, 96 kHz WAV (the download needs a login). Source: https://freesound.org/people/donyaquick/sounds/330410/
  - The same page links public previews with `Access-Control-Allow-Origin: *` and no auth: `https://cdn.freesound.org/previews/330/330410_1089898-hq.ogg` / `-hq.mp3`. I checked these with curl on 2026-10-09.
- **Samples to avoid.** Existing web harmonium apps use `harmonium-kannan-orig.wav`, which has no stated source or license.
- **Sustain loops.** Sustained notes need loops. SFZ uses `loop_mode` = `loop_continuous`/`loop_sustain` (https://sfzformat.com/opcodes/loop_mode). In Web Audio, use `loop`/`loopStart`/`loopEnd` on `AudioBufferSourceNode`.

## 4. Key mapping conventions

- **Ableton.** Home row = white keys from C, W E T Y U = black keys, Z/X = octave. Source: https://www.ableton.com/en/live-manual/12/routing-and-i-o/
- **AudioKeys.** Offers a 1-row mode (Ableton-like) and a 2-row tracker mode (Z row plus Q row). Source: https://github.com/kylestetz/AudioKeys
- **Open-source web harmoniums.**
  - https://github.com/pankaj28843/webharmonium: one looped WAV re-pitched per note, a convolver reverb, transpose, and "stack" octave reeds.
  - https://github.com/DhakadG/web-harmonium: physical key positions, sargam labels, and reed stacking with about ±14 cent detune.

## 5. Libraries (versions from registry.npmjs.org, 2026-10-09)

| Library | License | Latest | Notes |
|---|---|---|---|
| Tone.js | MIT | 15.1.22 (2025-04) | `lookAhead` adds delay to scheduled events |
| smplr | MIT | 1.1.0 (2026-09) | Sampler, SF2, velocity layers, loops |
| soundfont-player | MIT | 0.12.0 | archived 2023 |
| WebAudioFont | GPL-3.0 | 3.0.4 (2022) | stale |
| js-synthesizer | BSD-3 + LGPL FluidSynth | 1.13.0 (2026-04) | SF2 synthesis in WASM |
| SpessaSynth | Apache-2.0 | 4.3.x (2026-08) | SF2/SF3/DLS synthesis in an AudioWorklet, very active |

Decision: plain Web Audio for phase 1, so there is no scheduler between a keypress and the sound.

## 6. Metronome

"A Tale of Two Clocks" (Chris Wilson): a JS timer runs about every 25 ms and schedules any click that falls within the next ~100 ms against `audioContext.currentTime`, then plays it with `start(when)`. The visual beat follows the audio clock via `requestAnimationFrame`. Source: https://web.dev/articles/audio-scheduling. Running the timer in a Worker avoids background-tab throttling.

## 7. Reverb and tuning

- `ConvolverNode` with an impulse response, mixed through dry and wet gains. OpenAIR impulse responses are licensed individually, mostly CC BY 4.0: https://www.openair.hosted.york.ac.uk/?page_id=2. Phase 1 generates its impulse response instead, so it needs no licence.
- Effective rate = `playbackRate × 2^(detune/1200)`. `detune` is in cents, which suits master tuning and transpose. Source: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/detune

## 8. Phase 2: soundpack formats

- **SFZ.** Plain text with `<global>/<group>/<region>` sections. Main opcodes: `sample`, `lokey/hikey`, `pitch_keycenter`, `lovel/hivel`, `loop_mode`, `loop_start/loop_end`. Source: https://sfzformat.com/headers/
- **SF2/SF3.** Binary RIFF banks. LMMS's Sf2 Player loads them: https://docs.lmms.io/user-manual/instruments/sf2-player
- **DecentSampler `.dspreset`.** XML with `<sample path rootNote loNote hiNote loVel hiVel loopStart loopEnd>`. Sources: https://decentsampler-developers-guide.readthedocs.io/en/latest/introduction.html, https://github.com/DecentSamples/DecentSampler-schema
- **How other DAWs load instruments.**
  - Zrythm has an SFZ/SF2 scan: https://manual.zrythm.org/en/plugins-files/intro.html
  - Ardour uses plugin samplers.
  - openDAW (AGPL) has Soundfont and sampler devices built on the `soundfont2` library: https://github.com/andremichelle/openDAW
- **sfizz.** Archived 2026-06-21: https://github.com/sfztools/sfizz. The web port is experimental: https://github.com/sfztools/sfizz-webaudio. An alternative is https://github.com/sfzlab/sfz-web-player (CC0).

### Recommendation for phase 2
Keep our own JSON pack manifest, and write importers that convert into it: SFZ in a zip, and DecentSampler `.dspreset`, whose fields map almost one to one. Play SF2/SF3 through SpessaSynth (Apache-2.0) wrapped as an Instrument. See `docs/adr/0001-own-pack-manifest.md`.
