# 0001: Our own JSON pack manifest; external formats are imported into it

Status: accepted (2026-10-09)

## Context
Phase 2 must let users load other instruments from external soundpacks. Sampler formats include SFZ (text), DecentSampler `.dspreset` (XML), and SF2/SF3 (binary SoundFont banks). The only SFZ engine for the web is sfizz-webaudio, which is experimental, and upstream sfizz was archived in June 2026.

## Decision
The app plays one format: a JSON **Pack manifest**. It lists sample URLs, root notes, note and velocity ranges, loop points and an envelope. SFZ-in-zip and `.dspreset` importers convert into this manifest in the browser. SF2/SF3 is the one exception: it runs through SpessaSynth, wrapped behind the same `Instrument` interface, because SoundFont generators and modulators do not reduce to a flat sample map.

## Consequences
- One playback engine (`instruments/sampler.ts`) serves the Harmonium and every imported sample pack.
- Importers support only the subset of each format that the manifest can express, so advanced SFZ opcodes (modulation, round robins, scripts) are dropped.
- Adding a format means writing a converter, not a new engine.
