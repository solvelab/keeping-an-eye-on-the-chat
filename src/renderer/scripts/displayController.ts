import type { ChatMessage } from '../../shared/types';

type Phase = 'idle' | 'showing' | 'exiting';

export interface DisplayCallbacks {
  playEntranceAnimation?: (message: ChatMessage) => Promise<void>;
  playAttentionPause?: (durationMs: number) => Promise<void>;
  playReadingAnimation?: (message: ChatMessage) => Promise<number>;
  playExitAnimation?: () => Promise<void>;
  cancel?: () => void;
}

export interface DisplayControllerOptions {
  displaySeconds?: number;
  exitAnimationMs?: number;
  attentionPauseMs?: number;
  diagnostics?: boolean;
  onUpdate?: (state: DisplayState) => void;
  onDisplay?: DisplayCallbacks;
  maxMessageLength?: number;
  ignoreCommandPrefix?: string;
  ignoreUsers?: string[];
  maxQueueLength?: number;
}

export interface DisplayState {
  activeMessage: ChatMessage | null;
  queueLength: number;
  totalReceived: number;
  totalDisplayed: number;
  droppedCount: number;
  ignoredCount: number;
  truncatedCount: number;
}

export class DisplayController {
  private displayMs: number;
  private exitMs: number;
  private attentionPauseMs: number;
  private maxMessageLength: number;
  private maxQueueLength: number;
  private ignoreCommandPrefix: string;
  private ignoreUsers: Set<string>;
  private diagnostics: boolean;
  private onUpdate: ((state: DisplayState) => void) | undefined;
  private onDisplay: DisplayCallbacks;
  private queue: ChatMessage[];
  private seenIds: InstanceType<typeof window.boundedIdSet.BoundedIdSet>;
  private activeMessage: ChatMessage | null;
  private phase: Phase;
  private sequenceToken: number;
  private totalReceived: number;
  private totalDisplayed: number;
  private droppedCount: number;
  private ignoredCount: number;
  private truncatedCount: number;
  private displayTimer: ReturnType<typeof setTimeout> | null;
  private exitTimer: ReturnType<typeof setTimeout> | null;

  constructor({
    displaySeconds,
    exitAnimationMs,
    attentionPauseMs,
    diagnostics,
    onUpdate,
    onDisplay,
    maxMessageLength,
    ignoreCommandPrefix,
    ignoreUsers,
    maxQueueLength
  }: DisplayControllerOptions) {
    const fallbackSeconds = 5;
    const parsedSeconds = Number(displaySeconds);
    const safeSeconds =
      Number.isFinite(parsedSeconds) && parsedSeconds > 0
        ? parsedSeconds
        : fallbackSeconds;
    const fallbackExitMs = 400;
    const parsedExitMs = Number(exitAnimationMs);
    const safeExitMs =
      Number.isFinite(parsedExitMs) && parsedExitMs >= 0
        ? parsedExitMs
        : fallbackExitMs;
    const fallbackAttentionPauseMs = 1000;
    const parsedAttentionPauseMs = Number(attentionPauseMs);
    const safeAttentionPauseMs =
      Number.isFinite(parsedAttentionPauseMs) && parsedAttentionPauseMs >= 0
        ? parsedAttentionPauseMs
        : fallbackAttentionPauseMs;
    const fallbackMaxLength = 140;
    const parsedMaxLength = Number(maxMessageLength);
    const safeMaxLength =
      Number.isFinite(parsedMaxLength) && parsedMaxLength > 0
        ? parsedMaxLength
        : fallbackMaxLength;
    const fallbackQueueLength = 50;
    const parsedQueueLength = Number(maxQueueLength);
    const safeQueueLength =
      Number.isFinite(parsedQueueLength) && parsedQueueLength > 0
        ? parsedQueueLength
        : fallbackQueueLength;
    const safePrefix =
      typeof ignoreCommandPrefix === 'string' ? ignoreCommandPrefix : '!';
    const normalizedIgnoreUsers = Array.isArray(ignoreUsers) ? ignoreUsers : [];

    this.displayMs = safeSeconds * 1000;
    this.exitMs = safeExitMs;
    this.attentionPauseMs = safeAttentionPauseMs;
    this.maxMessageLength = safeMaxLength;
    this.maxQueueLength = safeQueueLength;
    this.ignoreCommandPrefix = safePrefix;
    this.ignoreUsers = new Set(
      normalizedIgnoreUsers
        .map((user) => String(user).trim().toLowerCase())
        .filter(Boolean)
    );
    this.diagnostics = Boolean(diagnostics);
    this.onUpdate = onUpdate;
    this.onDisplay = onDisplay || {};
    this.queue = [];
    // Bounded: the overlay used to retain every id of the whole stream.
    this.seenIds = new window.boundedIdSet.BoundedIdSet(
      window.boundedIdSet.OVERLAY_SEEN_ID_LIMIT
    );
    this.activeMessage = null;
    this.phase = 'idle';
    this.sequenceToken = 0;
    this.totalReceived = 0;
    this.totalDisplayed = 0;
    this.droppedCount = 0;
    this.ignoredCount = 0;
    this.truncatedCount = 0;
    this.displayTimer = null;
    this.exitTimer = null;
  }

  enqueue(message: ChatMessage): void {
    if (!message || typeof message.id !== 'string') {
      return;
    }

    if (this.seenIds.has(message.id)) {
      return;
    }

    this.seenIds.add(message.id);
    this.totalReceived += 1;
    const user =
      typeof message.user === 'string' ? message.user.trim() : String(message.user || '').trim();
    const text =
      typeof message.text === 'string' ? message.text.trim() : String(message.text || '').trim();

    if (this.ignoreUsers.has(user.toLowerCase())) {
      this.ignoredCount += 1;
      this.emitUpdate();
      return;
    }

    if (this.ignoreCommandPrefix && text.startsWith(this.ignoreCommandPrefix)) {
      this.ignoredCount += 1;
      this.emitUpdate();
      return;
    }

    let finalText = text;
    if (finalText.length > this.maxMessageLength) {
      finalText = `${finalText.slice(0, this.maxMessageLength).trimEnd()}…`;
      this.truncatedCount += 1;
    }

    const normalizedMessage: ChatMessage = {
      ...message,
      user,
      text: finalText
    };

    this.queue.push(normalizedMessage);
    while (this.queue.length > this.maxQueueLength) {
      this.queue.shift();
      this.droppedCount += 1;
    }

    this.emitUpdate();
    this.startNextIfIdle();
  }

  startNextIfIdle(): void {
    if (this.phase !== 'idle' || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    this.activeMessage = next;
    this.phase = 'showing';
    this.totalDisplayed += 1;
    this.emitUpdate();
    this.logDiagnostics(`DISPLAY_START id=${next.id}`);

    const token = this.nextSequenceToken();
    void this.runDisplaySequence(next, token);
  }

  private nextSequenceToken(): number {
    this.sequenceToken += 1;
    this.clearTimers();
    if (typeof this.onDisplay.cancel === 'function') {
      this.onDisplay.cancel();
    }
    return this.sequenceToken;
  }

  private isSequenceActive(token: number): boolean {
    return token === this.sequenceToken;
  }

  private clearTimers(): void {
    if (this.displayTimer) {
      clearTimeout(this.displayTimer);
      this.displayTimer = null;
    }
    if (this.exitTimer) {
      clearTimeout(this.exitTimer);
      this.exitTimer = null;
    }
  }

  private async runDisplaySequence(message: ChatMessage, token: number): Promise<void> {
    const playEntranceAnimation = this.onDisplay.playEntranceAnimation;
    const playAttentionPause = this.onDisplay.playAttentionPause;
    const playReadingAnimation = this.onDisplay.playReadingAnimation;
    const playExitAnimation = this.onDisplay.playExitAnimation;

    // 1. Entrance animation
    if (typeof playEntranceAnimation === 'function') {
      this.logDiagnostics('entrance start');
      await playEntranceAnimation(message);
      if (!this.isSequenceActive(token)) {
        return;
      }
      this.logDiagnostics('entrance complete');
    }

    // 2. Attention pause (avatar looks forward before speaking)
    if (typeof playAttentionPause === 'function' && this.attentionPauseMs > 0) {
      this.logDiagnostics('attention pause start');
      await playAttentionPause(this.attentionPauseMs);
      if (!this.isSequenceActive(token)) {
        return;
      }
      this.logDiagnostics('attention pause complete');
    }

    // 3. Reading animation
    let readingDuration = 0;
    if (typeof playReadingAnimation === 'function') {
      this.logDiagnostics('reading start');
      readingDuration = await playReadingAnimation(message);
      if (!this.isSequenceActive(token)) {
        return;
      }
      const safeDuration = Number.isFinite(readingDuration) ? readingDuration : 0;
      this.logDiagnostics(
        `reading complete (duration=${safeDuration.toFixed(2)}s)`
      );
    }

    this.logDiagnostics('display timer start');
    await this.waitDisplayDuration(this.displayMs);
    if (!this.isSequenceActive(token)) {
      return;
    }
    this.logDiagnostics('display timer complete');

    const endedId = this.activeMessage ? this.activeMessage.id : message.id;
    this.activeMessage = null;
    this.phase = 'exiting';
    this.emitUpdate();
    this.logDiagnostics(`DISPLAY_END id=${endedId}`);

    this.logDiagnostics('exit start');
    if (typeof playExitAnimation === 'function') {
      await playExitAnimation();
    } else {
      await this.waitExitDuration(this.exitMs);
    }
    if (!this.isSequenceActive(token)) {
      return;
    }
    this.logDiagnostics('exit complete');

    this.phase = 'idle';
    this.logDiagnostics('EXIT_DONE');
    this.startNextIfIdle();
  }

  private waitDisplayDuration(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.displayTimer = setTimeout(() => {
        this.displayTimer = null;
        resolve();
      }, durationMs);
    });
  }

  private waitExitDuration(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.exitTimer = setTimeout(() => {
        this.exitTimer = null;
        resolve();
      }, durationMs);
    });
  }

  handleDisplayEnd(): void {
    if (this.phase !== 'showing') {
      return;
    }

    const endedId = this.activeMessage ? this.activeMessage.id : 'unknown';
    this.logDiagnostics(`DISPLAY_END id=${endedId}`);
    this.activeMessage = null;
    this.displayTimer = null;
    this.phase = 'exiting';
    this.emitUpdate();

    this.exitTimer = setTimeout(() => {
      this.handleExitDone();
    }, this.exitMs);
  }

  private handleExitDone(): void {
    if (this.phase !== 'exiting') {
      return;
    }

    this.exitTimer = null;
    this.phase = 'idle';
    this.logDiagnostics('EXIT_DONE');
    this.startNextIfIdle();
  }

  private logDiagnostics(message: string): void {
    if (!this.diagnostics) {
      return;
    }

    console.info(`[diagnostics] ${message}`);
  }

  private emitUpdate(): void {
    if (typeof this.onUpdate !== 'function') {
      return;
    }

    this.onUpdate(this.getState());
  }

  getState(): DisplayState {
    return {
      activeMessage: this.activeMessage,
      queueLength: this.queue.length,
      totalReceived: this.totalReceived,
      totalDisplayed: this.totalDisplayed,
      droppedCount: this.droppedCount,
      ignoredCount: this.ignoredCount,
      truncatedCount: this.truncatedCount
    };
  }
}

// The overlay loads this file through a <script> tag, so the class is published on
// window. Guarded so the same module can be required from a plain Node test runner.
if (typeof window !== 'undefined') {
  window.DisplayController = DisplayController;
}
