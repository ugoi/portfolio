import { useState, useEffect } from "react";

/**
 * Custom hook to detect if the device is mobile based on screen width
 * @param breakpoint - The width threshold in pixels (default: 768)
 * @returns boolean indicating if the device is considered mobile
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if device is mobile based on screen width only
    const checkMobile = () => {
      const width = window.innerWidth;
      // Consider it mobile if width is less than the breakpoint
      setIsMobile(width < breakpoint);
    };

    // Initial check
    checkMobile();

    // Update on resize
    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, [breakpoint]);

  return isMobile;
}
