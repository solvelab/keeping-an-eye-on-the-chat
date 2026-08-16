import type { ChatMessage, OverlayConfig } from '../../shared/types';

declare global {
  interface Window {
    gsap: typeof import('gsap').gsap;
    DisplayController: typeof import('./displayController').DisplayController;
    AvatarAnimator: typeof import('./avatarAnimator').AvatarAnimator;
    AvatarUI: typeof import('./avatarUI').AvatarUI;
    boundedIdSet: {
      BoundedIdSet: typeof import('../../shared/boundedIdSet').BoundedIdSet;
      OVERLAY_SEEN_ID_LIMIT: number;
      CHAT_SOURCE_SEEN_ID_LIMIT: number;
    };
    overlayChat?: {
      onMessage: (handler: (message: ChatMessage) => void) => void;
      getConfig: () => OverlayConfig;
    };
  }
}

export {};
