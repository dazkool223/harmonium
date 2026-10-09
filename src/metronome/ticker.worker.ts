/// <reference lib="webworker" />
// Timers in a Worker aren't throttled like main-thread timers in background tabs.
let timer: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<{ cmd: 'start' | 'stop'; interval?: number }>) => {
  if (timer) clearInterval(timer);
  timer = null;
  if (e.data.cmd === 'start') {
    timer = setInterval(() => self.postMessage('tick'), e.data.interval ?? 25);
  }
};
