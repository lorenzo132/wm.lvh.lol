type StartPreview = (done: () => void) => () => void;

// Shared by all cards, including during pagination and rapid scrolling.
export function createPreviewQueue(limit = 4) {
  const pending: Array<() => void> = [];
  let active = 0;
  function drain() {
    while (active < limit && pending.length) pending.shift()!();
  }
  return (start: StartPreview) => {
    let finished = false;
    let running = false;
    let abort: (() => void) | undefined;
    const done = () => {
      if (finished) return;
      finished = true;
      if (running) active--;
      // Let React finish cancelling an entire page before starting more requests.
      queueMicrotask(drain);
    };
    const run = () => {
      running = true;
      active++;
      try { abort = start(done); }
      catch { done(); }
    };
    pending.push(run);
    drain();
    return () => {
      if (finished) return;
      const index = pending.indexOf(run);
      if (index !== -1) pending.splice(index, 1);
      abort?.();
      done();
    };
  };
}

export const queuePreview = createPreviewQueue();
