import React, { useEffect, useRef, useState } from 'react';

/**
 * Small dependency-free count-up: animates from 0 to `value` once on mount
 * (and whenever `value` changes), respecting prefers-reduced-motion.
 */
export default function CountUp({ value = 0, duration = 700, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    startRef.current = null;
    let raf;

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(fromRef.current + (value - fromRef.current) * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}
