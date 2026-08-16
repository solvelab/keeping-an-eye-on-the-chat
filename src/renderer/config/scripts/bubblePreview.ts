/**
 * A live speech bubble inside the configuration wizard.
 *
 * The author-name treatments are visual, and the wizard could only describe them
 * in words — so the choice was made blind, and only testable by pressing Start.
 *
 * The preview renders the overlay's own markup and is styled by the overlay's
 * own stylesheet, loaded into this page by a second `<link>`. That is the whole
 * design: a preview with its own copy of the bubble styles would look right
 * while the overlay did something else, which is worse than no preview at all.
 * Only the container is overridden here — `.avatar-ui` is `position: fixed`, and
 * a preview has to sit in the document flow.
 */

import type { AuthorStyle } from '../../../shared/types';
import type { Platform } from '../../../shared/platforms';

/** What the preview needs to know from the configuration being edited. */
export interface BubblePreviewState {
  authorStyle: AuthorStyle;
  bubbleMaxWidth: number;
  /** The platforms with a URL filled in, in the order they are configured. */
  platforms: Platform[];
}

/** A language table, keyed by translation id. */
type Translations = Record<string, string>;

/** How long each platform holds the badge when both are configured. */
const PLATFORM_ROTATION_MS = 3000;

/** The stress case: 25 characters, no spaces, which is what both platforms allow. */
export const LONG_NAME_SAMPLE = 'xX_DarkLordStreamer99_Xx';

/** Build the avatar's face, matching the structure the overlay builds. */
function buildAvatar(): HTMLDivElement {
  const avatar = document.createElement('div');
  avatar.className = 'avatar';

  const face = document.createElement('div');
  face.className = 'avatar__face';

  const eyes = document.createElement('div');
  eyes.className = 'avatar__eyes';
  for (const side of ['left', 'right']) {
    const eye = document.createElement('div');
    eye.className = `avatar__eye avatar__eye--${side}`;
    eyes.appendChild(eye);
  }

  const mouth = document.createElement('div');
  mouth.className = 'avatar__mouth';
  const mouthInner = document.createElement('div');
  mouthInner.className = 'avatar__mouth-inner';
  mouth.appendChild(mouthInner);

  face.appendChild(eyes);
  face.appendChild(mouth);
  avatar.appendChild(face);
  return avatar;
}

export class BubblePreview {
  private t: Translations;
  private root: HTMLDivElement;
  private container: HTMLDivElement;
  private bubble: HTMLDivElement;
  private badge: HTMLDivElement;
  private author: HTMLSpanElement;
  private message: HTMLSpanElement;
  private longNameButton: HTMLButtonElement;
  private titleLabel: HTMLSpanElement;

  private state: BubblePreviewState = {
    authorStyle: 'subtle',
    bubbleMaxWidth: 420,
    platforms: [],
  };
  private showingLongName = false;
  private rotation: ReturnType<typeof setInterval> | null = null;
  private rotationIndex = 0;

  constructor(t: Translations) {
    this.t = t;

    this.root = document.createElement('div');
    this.root.className = 'bubble-preview';

    const head = document.createElement('div');
    head.className = 'bubble-preview__head';

    this.titleLabel = document.createElement('span');
    this.titleLabel.className = 'bubble-preview__title';

    this.longNameButton = document.createElement('button');
    this.longNameButton.type = 'button';
    this.longNameButton.className = 'bubble-preview__toggle';
    this.longNameButton.id = 'previewLongName';
    this.longNameButton.addEventListener('click', () => {
      this.showingLongName = !this.showingLongName;
      this.render();
    });

    head.appendChild(this.titleLabel);
    head.appendChild(this.longNameButton);

    const stage = document.createElement('div');
    stage.className = 'bubble-preview__stage';

    this.container = document.createElement('div');
    // avatar-ui--visible skips the entrance transition: the preview is a still.
    this.container.className = 'avatar-ui avatar-ui--visible';

    this.bubble = document.createElement('div');
    this.bubble.className = 'avatar-ui__bubble';

    this.badge = document.createElement('div');
    this.badge.className = 'avatar-ui__platform';

    const text = document.createElement('div');
    text.className = 'avatar-ui__text';
    this.author = document.createElement('span');
    this.author.className = 'avatar-ui__author';
    this.message = document.createElement('span');
    this.message.className = 'avatar-ui__message';
    text.appendChild(this.author);
    text.appendChild(this.message);

    this.bubble.appendChild(this.badge);
    this.bubble.appendChild(text);
    this.container.appendChild(buildAvatar());
    this.container.appendChild(this.bubble);
    stage.appendChild(this.container);

    this.root.appendChild(head);
    this.root.appendChild(stage);

    this.applyTranslations();
    this.render();
  }

  /** The node to place in the form. */
  get element(): HTMLDivElement {
    return this.root;
  }

  /** Re-read the language table, after the user switches language. */
  setTranslations(t: Translations): void {
    this.t = t;
    this.applyTranslations();
    this.render();
  }

  /** Take the values that affect the bubble and redraw. */
  update(state: Partial<BubblePreviewState>): void {
    this.state = { ...this.state, ...state };
    this.syncRotation();
    this.render();
  }

  /** Stop the platform rotation. Called when the wizard tears the form down. */
  destroy(): void {
    if (this.rotation) {
      clearInterval(this.rotation);
      this.rotation = null;
    }
  }

  private applyTranslations(): void {
    this.titleLabel.textContent = this.t.previewTitle || 'Preview';
    this.longNameButton.textContent = this.showingLongName
      ? this.t.previewShortName || 'Short name'
      : this.t.previewLongName || 'Long name';
  }

  /**
   * Alternate the badge only when both platforms are configured.
   *
   * With one platform there is nothing to alternate, and a timer running for no
   * reason is a timer that outlives the reason it was started.
   */
  private syncRotation(): void {
    const needsRotation = this.state.platforms.length > 1;

    if (!needsRotation) {
      this.destroy();
      this.rotationIndex = 0;
      return;
    }

    if (this.rotation) {
      return;
    }

    this.rotation = setInterval(() => {
      this.rotationIndex += 1;
      this.render();
    }, PLATFORM_ROTATION_MS);
  }

  private currentPlatform(): Platform | null {
    const { platforms } = this.state;
    if (platforms.length === 0) {
      return null;
    }
    return platforms[this.rotationIndex % platforms.length];
  }

  private render(): void {
    const labels = window.platforms ? window.platforms.PLATFORM_LABELS : null;
    const platform = this.currentPlatform();

    this.container.style.setProperty('--bubble-max-width', `${this.state.bubbleMaxWidth}px`);
    this.bubble.dataset.authorStyle = this.state.authorStyle;

    if (platform && labels) {
      this.badge.textContent = labels[platform];
      this.bubble.dataset.platform = platform;
    } else {
      this.badge.textContent = '';
      delete this.bubble.dataset.platform;
    }

    const user = this.showingLongName
      ? LONG_NAME_SAMPLE
      : this.t.previewSampleUser || 'poppybdo';
    const keepsColon = this.state.authorStyle === 'plain' || this.state.authorStyle === 'tinted';

    this.author.textContent = keepsColon ? `${user}:` : user;
    this.message.textContent = this.t.previewSampleText || 'oi galera, chegando agora!';

    this.applyTranslations();
  }
}

// Published for the wizard's <script> tag loader; guarded so the module can also
// be required from a plain Node test runner.
if (typeof window !== 'undefined') {
  window.bubblePreview = { BubblePreview, LONG_NAME_SAMPLE };
}
