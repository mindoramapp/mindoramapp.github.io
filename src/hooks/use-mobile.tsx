import * as React from "react";

// "Compact" screens get touch-first layouts: phones in portrait (narrow) and in landscape (short).
const COMPACT_QUERY = "(max-width: 767px), (max-height: 560px)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

// Touch-first input (phones, tablets): no hover, no physical Tab/Enter keys to create nodes.
const TOUCH_QUERY = "(pointer: coarse)";

export function useIsTouch() {
  const [isTouch, setIsTouch] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(TOUCH_QUERY).matches,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(TOUCH_QUERY);
    const onChange = () => setIsTouch(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isTouch;
}
