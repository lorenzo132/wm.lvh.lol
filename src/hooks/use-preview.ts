import { useEffect, useRef, useState } from "react";
import { queuePreview } from "@/utils/previewQueue";

export function usePreview(source?: string) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<'waiting' | 'loaded' | 'error'>('waiting');

  useEffect(() => {
    setStatus('waiting');
    const image = imageRef.current;
    const container = containerRef.current;
    if (!source || !image || !container) return;
    let cancel: (() => void) | undefined;
    const load = () => {
      cancel = queuePreview(done => {
        const finish = (next: 'loaded' | 'error') => {
          clearTimeout(timeout);
          image.onload = image.onerror = null;
          setStatus(next);
          done();
        };
        // A stalled host must not occupy a queue slot indefinitely.
        const timeout = window.setTimeout(() => {
          image.removeAttribute('src');
          finish('error');
        }, 30000);
        image.onload = () => finish('loaded');
        image.onerror = () => finish('error');
        image.fetchPriority = 'low';
        image.src = source;
        return () => {
          clearTimeout(timeout);
          image.onload = image.onerror = null;
          image.removeAttribute('src');
        };
      });
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: '160px' });
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancel?.();
      image.removeAttribute('src');
    };
  }, [source]);

  return { containerRef, imageRef, status };
}
