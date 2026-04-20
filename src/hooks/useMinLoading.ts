import { useState, useEffect, useRef } from 'react';

export function useMinLoading(actual: boolean, minMs = 1000): boolean {
  const [show, setShow] = useState(true);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (actual) {
      startRef.current = Date.now();
      setShow(true);
      return;
    }
    const elapsed = Date.now() - startRef.current;
    const wait = Math.max(0, minMs - elapsed);
    const t = setTimeout(() => setShow(false), wait);
    return () => clearTimeout(t);
  }, [actual, minMs]);

  return show;
}
