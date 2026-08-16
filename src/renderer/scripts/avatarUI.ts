import type { AuthorStyle, ChatMessage, OverlayAnchor } from '../../shared/types';
import type { Platform } from '../../shared/platforms';
import type { AvatarAnimator } from './avatarAnimator';

interface AvatarUIOptions {
  root?: HTMLElement;
  anchor?: OverlayAnchor;
  margin?: number;
  bubbleMaxWidth?: number;
  authorStyle?: AuthorStyle;
  diagnostics?: boolean;
}

interface SetActiveMessageOptions {
  animateEntrance?: boolean;
  startTalking?: boolean;
  lookAtBubble?: boolean;
}

export class AvatarUI {
  private root: HTMLElement;
  private container: HTMLDivElement;
  private activeMessageId: string | null;
  private lookFrame: number | null;
  private diagnostics: boolean;
  private avatar: HTMLDivElement;
  private face: HTMLDivElement;
  private eyeGroup: HTMLDivElement;
  private eyeLeft: HTMLDivElement;
  private eyeRight: HTMLDivElement;
  private mouth: HTMLDivElement;
  private mouthInner: HTMLDivElement;
  private bubble: HTMLDivElement;
  private bubbleText: HTMLDivElement;
  private bubbleAuthor: HTMLSpanElement;
  private bubbleMessage: HTMLSpanElement;
  private platformBadge: HTMLDivElement;
  private animator: AvatarAnimator | null;

  constructor({
    root,
    anchor,
    margin,
    bubbleMaxWidth,
    authorStyle,
    diagnostics
  }: AvatarUIOptions) {
    this.root = root || document.body;
    this.container = document.createElement('div');
    this.container.className = 'avatar-ui';
    this.activeMessageId = null;
    this.lookFrame = null;
    this.diagnostics = Boolean(diagnostics);

    this.avatar = document.createElement('div');
    this.avatar.className = 'avatar';

    this.face = document.createElement('div');
    this.face.className = 'avatar__face';

    this.eyeGroup = document.createElement('div');
    this.eyeGroup.className = 'avatar__eyes';

    this.eyeLeft = document.createElement('div');
    this.eyeLeft.className = 'avatar__eye avatar__eye--left';

    this.eyeRight = document.createElement('div');
    this.eyeRight.className = 'avatar__eye avatar__eye--right';

    this.eyeGroup.appendChild(this.eyeLeft);
    this.eyeGroup.appendChild(this.eyeRight);

    this.mouth = document.createElement('div');
    this.mouth.className = 'avatar__mouth';
    this.mouthInner = document.createElement('div');
    this.mouthInner.className = 'avatar__mouth-inner';
    this.mouth.appendChild(this.mouthInner);

    this.face.appendChild(this.eyeGroup);
    this.face.appendChild(this.mouth);
    this.avatar.appendChild(this.face);

    this.bubble = document.createElement('div');
    this.bubble.className = 'avatar-ui__bubble';

    this.bubbleText = document.createElement('div');
    this.bubbleText.className = 'avatar-ui__text';

    // Author and message are separate elements so a style can tell them apart.
    // They were one string until the streamer could choose how the name reads.
    this.bubbleAuthor = document.createElement('span');
    this.bubbleAuthor.className = 'avatar-ui__author';
    this.bubbleMessage = document.createElement('span');
    this.bubbleMessage.className = 'avatar-ui__message';
    this.bubbleText.appendChild(this.bubbleAuthor);
    this.bubbleText.appendChild(this.bubbleMessage);

    // Which platform the message came from. Absolutely positioned inside the
    // bubble, so it cannot shift the text or disturb the avatar animation.
    this.platformBadge = document.createElement('div');
    this.platformBadge.className = 'avatar-ui__platform';

    this.bubble.appendChild(this.platformBadge);
    this.bubble.appendChild(this.bubbleText);
    this.container.appendChild(this.avatar);
    this.container.appendChild(this.bubble);
    this.root.appendChild(this.container);
    this.setPosition(anchor, margin);
    this.setBubbleMaxWidth(bubbleMaxWidth);
    this.setAuthorStyle(authorStyle);

    this.animator = window.AvatarAnimator
      ? new window.AvatarAnimator({
          avatar: this.avatar,
          eyes: this.eyeGroup,
          eyeLeft: this.eyeLeft,
          eyeRight: this.eyeRight,
          mouth: this.mouth,
          mouthInner: this.mouthInner,
          diagnostics: this.diagnostics
        })
      : null;
    if (this.animator) {
      this.animator.startIdle();
    }
  }

  setActiveMessage(message: ChatMessage | null, options: SetActiveMessageOptions = {}): void {
    const {
      animateEntrance = true,
      startTalking = true,
      lookAtBubble = true
    } = options;
    if (message) {
      const user = message.user || '';
      const text = message.text || '';
      this.setAuthorAndText(user, text);
      this.showPlatform(message.platform);
      const nextId = message.id || `${user}:${text}`;
      const shouldReplay = nextId !== this.activeMessageId;
      this.activeMessageId = nextId;
      if (shouldReplay) {
        if (animateEntrance) {
          this.replayEnterAnimation();
        } else {
          this.container.classList.remove('avatar-ui--visible');
        }
      } else if (animateEntrance) {
        this.container.classList.add('avatar-ui--visible');
      }
      if (this.animator && startTalking && shouldReplay) {
        this.animator.startTalking(text, this.bubble, message.id);
        if (lookAtBubble) {
          this.queueLookAtBubble();
        }
      }
      return;
    }

    this.container.classList.remove('avatar-ui--visible');
    this.activeMessageId = null;
    if (this.animator) {
      this.animator.stopTalkingAndReset();
      this.animator.lookCenter();
      this.animator.startBlinking();
    }
  }

  /**
   * Show which platform the active message came from.
   *
   * The label comes from the shared platform table, published on window by the
   * overlay's <script> tags. An unknown value leaves the badge empty rather
   * than printing a raw id.
   */
  private showPlatform(platform: Platform | undefined): void {
    const labels = window.platforms ? window.platforms.PLATFORM_LABELS : null;
    const label = platform && labels ? labels[platform] : '';

    this.platformBadge.textContent = label || '';
    if (label) {
      this.bubble.dataset.platform = platform;
    } else {
      delete this.bubble.dataset.platform;
    }
  }

  setPosition(anchor?: OverlayAnchor, margin?: number): void {
    const allowedAnchors = new Set<OverlayAnchor>([
      'bottom-left',
      'bottom-right',
      'top-left',
      'top-right'
    ]);
    const safeAnchor = anchor && allowedAnchors.has(anchor) ? anchor : 'bottom-left';
    const parsedMargin = Number(margin);
    const safeMargin =
      Number.isFinite(parsedMargin) && parsedMargin >= 0 ? parsedMargin : 24;

    this.container.dataset.anchor = safeAnchor;
    this.container.style.setProperty('--overlay-margin', `${safeMargin}px`);
  }

  setBubbleMaxWidth(maxWidth?: number): void {
    const parsedWidth = Number(maxWidth);
    const safeWidth =
      Number.isFinite(parsedWidth) && parsedWidth >= 120 ? parsedWidth : 420;

    this.container.style.setProperty('--bubble-max-width', `${safeWidth}px`);
  }

  /**
   * Choose how the author's name is set apart from the message.
   *
   * Nothing branches on the value beyond this: the style becomes an attribute
   * and the stylesheet does the rest, so adding a treatment is a CSS rule.
   */
  setAuthorStyle(style?: AuthorStyle): void {
    const allowed = new Set<AuthorStyle>(['plain', 'tinted', 'label', 'subtle', 'chip']);
    const safeStyle = style && allowed.has(style) ? style : 'subtle';

    this.bubble.dataset.authorStyle = safeStyle;
  }

  /**
   * Put the author and the message into the bubble.
   *
   * The colon belongs to the author element rather than to the message, because
   * only some styles keep it: once the name is a chip or a label above the text,
   * a trailing colon reads as a typo. The separating space is CSS, not a text
   * node, so it cannot survive into a style that stacks the two.
   */
  private setAuthorAndText(user: string, text: string): void {
    const style = this.bubble.dataset.authorStyle;
    const keepsColon = style === 'plain' || style === 'tinted';

    this.bubbleAuthor.textContent = user ? (keepsColon ? `${user}:` : user) : '';
    this.bubbleMessage.textContent = text;
  }

  private replayEnterAnimation(): void {
    this.container.classList.remove('avatar-ui--visible');
    void this.container.offsetHeight;
    this.container.classList.add('avatar-ui--visible');
  }

  private waitForTransition(element: HTMLElement | null, fallbackMs = 450): Promise<void> {
    if (!element) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        element.removeEventListener('transitionend', onEnd);
        window.clearTimeout(timer);
        resolve();
      };
      const onEnd = (event: TransitionEvent): void => {
        if (event.target !== element) {
          return;
        }
        finish();
      };
      const timer = window.setTimeout(finish, fallbackMs);
      element.addEventListener('transitionend', onEnd);
    });
  }

  playEntranceAnimation(): Promise<void> {
    if (!this.container) {
      return Promise.resolve();
    }
    this.replayEnterAnimation();
    return this.waitForTransition(this.container);
  }

  /**
   * Play attention pause - avatar looks forward before speaking.
   * Creates an "I'm here and about to speak" moment.
   */
  playAttentionPause(durationMs = 1000): Promise<void> {
    if (durationMs <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      // Ensure avatar looks at center (forward)
      if (this.animator) {
        this.animator.lookCenter();
      }

      // Wait for the attention duration
      setTimeout(resolve, durationMs);
    });
  }

  playReadingAnimation(message: ChatMessage | null): Promise<number> {
    if (!message || !this.animator) {
      return Promise.resolve(0);
    }
    const text = message.text || '';
    let settled = false;
    return new Promise((resolve) => {
      const finish = (duration?: number): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(duration || 0);
      };
      const duration = this.animator!.startTalking(text, this.bubble, message.id, {
        onComplete: finish
      });
      this.queueLookAtBubble();
      if (!duration) {
        finish(0);
      }
    });
  }

  playExitAnimation(fallbackMs?: number): Promise<void> {
    if (!this.container) {
      return Promise.resolve();
    }
    this.container.classList.remove('avatar-ui--visible');
    return this.waitForTransition(this.container, fallbackMs);
  }

  cancelDisplaySequence(): void {
    if (this.lookFrame) {
      window.cancelAnimationFrame(this.lookFrame);
      this.lookFrame = null;
    }
    if (this.animator) {
      this.animator.stopTalkingAndReset();
      this.animator.lookCenter();
      this.animator.startBlinking();
    }
  }

  private queueLookAtBubble(): void {
    if (!this.animator) {
      return;
    }
    if (this.lookFrame) {
      window.cancelAnimationFrame(this.lookFrame);
    }
    this.lookFrame = window.requestAnimationFrame(() => {
      this.lookFrame = null;
      this.animator!.lookAtBubble(this.bubble);
    });
  }

  destroy(): void {
    if (this.lookFrame) {
      window.cancelAnimationFrame(this.lookFrame);
      this.lookFrame = null;
    }
    if (this.animator) {
      this.animator.destroy();
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// Exposed on window for the overlay's <script> tag loader. Guarded so the module
// can also be required from a plain Node test runner.
if (typeof window !== 'undefined') {
  window.AvatarUI = AvatarUI;
}
