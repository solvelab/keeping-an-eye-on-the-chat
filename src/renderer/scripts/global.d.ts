import type { ChatMessage, OverlayConfig } from '../../shared/types';

declare global {
  interface Window {
    gsap: typeof import('gsap').gsap;
    DisplayController: typeof import('./displayController').DisplayController;
    AvatarAnimator: typeof import('./avatarAnimator').AvatarAnimator;
    AvatarUI: typeof import('./avatarUI').AvatarUI;
    NotificationSound: typeof import('./notificationSound').NotificationSound;
    platforms: {
      PLATFORMS: readonly import('../../shared/platforms').Platform[];
      PLATFORM_LABELS: Record<import('../../shared/platforms').Platform, string>;
      isPlatform: (value: unknown) => boolean;
    };
    boundedIdSet: {
      BoundedIdSet: typeof import('../../shared/boundedIdSet').BoundedIdSet;
      OVERLAY_SEEN_ID_LIMIT: number;
      CHAT_SOURCE_SEEN_ID_LIMIT: number;
    };
    overlayChat?: {
      onMessage: (handler: (message: ChatMessage) => void) => void;
      onMuteChange: (handler: (muted: boolean) => void) => void;
      getConfig: () => OverlayConfig;
      waitForConfig: (timeoutMs?: number) => Promise<OverlayConfig>;
    };
  }
}

export {};
