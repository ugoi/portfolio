interface FullscreenElement extends HTMLElement {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  mozRequestFullScreen?: () => void;
}

interface DocumentWithFullscreen extends Document {
  mozCancelFullScreen?: () => void;
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  mozFullScreenEnabled?: boolean;
  mozFullScreenElement?: Element | null;
}

// Extend the standard Document interface
declare global {
  interface Document {
    webkitFullscreenEnabled?: boolean;
    webkitFullscreenElement?: Element | null;
    mozFullScreenEnabled?: boolean;
    mozFullScreenElement?: Element | null;
  }
}

// Create a wrapper that conforms to the standard Fullscreen API
const fullscreen = {
  enabled: !!(
    document.fullscreenEnabled ||
    (document as DocumentWithFullscreen).webkitFullscreenEnabled ||
    (document as DocumentWithFullscreen).mozFullScreenEnabled
  ),

  element:
    document.fullscreenElement ||
    (document as DocumentWithFullscreen).webkitFullscreenElement ||
    (document as DocumentWithFullscreen).mozFullScreenElement,

  request: async (element: FullscreenElement) => {
    if (element.webkitEnterFullscreen) {
      element.webkitEnterFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.requestFullscreen) {
      await element.requestFullscreen();
    }
  },

  exit: async () => {
    if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as DocumentWithFullscreen).mozCancelFullScreen) {
      const doc = document as DocumentWithFullscreen;
      if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      }
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  },

  // Add event listeners for all fullscreen change events
  addEventListener: (listener: EventListener) => {
    // Always add the standard event listener
    document.addEventListener("fullscreenchange", listener);

    // Add webkit event listener for Safari/iOS
    document.addEventListener("webkitfullscreenchange", listener);

    // Add moz event listener for Firefox
    document.addEventListener("mozfullscreenchange", listener);
  },

  removeEventListener: (listener: EventListener) => {
    // Always remove the standard event listener
    document.removeEventListener("fullscreenchange", listener);

    // Remove webkit event listener for Safari/iOS
    document.removeEventListener("webkitfullscreenchange", listener);

    // Remove moz event listener for Firefox
    document.removeEventListener("mozfullscreenchange", listener);
  },
};

export default fullscreen;
