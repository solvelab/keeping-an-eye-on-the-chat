type LookDirection = 'left' | 'right' | 'center';
type AnimatorState = 'idle' | 'talking' | 'waiting';

interface AvatarAnimatorOptions {
  avatar: HTMLElement;
  eyes: HTMLElement;
  eyeLeft: HTMLElement;
  eyeRight: HTMLElement;
  mouth: HTMLElement;
  mouthInner?: HTMLElement | null;
  diagnostics?: boolean;
}

interface TalkingOptions {
  onComplete?: (duration: number) => void;
}

interface VisemePreset {
  name?: string;
  weight?: number;
  scaleY: number[] | number;
  scaleX: number[] | number;
  y: number[] | number;
  innerOpacity: number[] | number;
}

interface VisemeShape {
  scaleY: number;
  scaleX: number;
  y: number;
  innerOpacity: number;
}

type GSAPInstance = typeof import('gsap').gsap;
type GSAPTimeline = ReturnType<GSAPInstance['timeline']>;
type GSAPTween = ReturnType<GSAPInstance['to']>;

export class AvatarAnimator {
  private avatar: HTMLElement;
  private eyes: HTMLElement;
  private eyeLeft: HTMLElement;
  private eyeRight: HTMLElement;
  private mouth: HTMLElement;
  private mouthInner: HTMLElement | null;
  private diagnostics: boolean;
  private gsap: GSAPInstance | null;
  private isTalking: boolean;
  private lookDirection: LookDirection;
  private lookOffsetPx: number;
  private lookThreshold: number;
  // Scheduled with window.setTimeout, whose handle is a plain number.
  private blinkTimer: number | null;
  private blinkTimeline: GSAPTimeline | null;
  private talkTimeline: GSAPTimeline | null;
  private lookTween: GSAPTween | null;
  private blinking: boolean;
  private speechIntensity: number;
  private sentencePauseBias: number;
  private lastTalkText: string;
  private talkCompletion: ((duration: number) => void) | null;
  private talkDuration: number;
  private state: AnimatorState;
  private talkingBubbleEl: HTMLElement | null;
  private eyeRestScaleLeft: number;
  private eyeRestScaleRight: number;
  private waitingEyeSide: 'left' | 'right';
  private waitingSeedSource: string;
  private waitingSeedCounter: number;
  private waitingBreathTween: GSAPTween | null;
  private isDestroyed: boolean;

  constructor({ avatar, eyes, eyeLeft, eyeRight, mouth, mouthInner, diagnostics }: AvatarAnimatorOptions) {
    this.avatar = avatar;
    this.eyes = eyes;
    this.eyeLeft = eyeLeft;
    this.eyeRight = eyeRight;
    this.mouth = mouth;
    this.mouthInner = mouthInner || null;
    this.diagnostics = Boolean(diagnostics);
    this.gsap = window.gsap || null;
    this.isTalking = false;
    this.lookDirection = 'center';
    this.lookOffsetPx = 5;
    this.lookThreshold = 4;
    this.blinkTimer = null;
    this.blinkTimeline = null;
    this.talkTimeline = null;
    this.lookTween = null;
    this.blinking = false;
    this.speechIntensity = 0.4;
    this.sentencePauseBias = 0;
    this.lastTalkText = '';
    this.talkCompletion = null;
    this.talkDuration = 0;
    this.state = 'idle';
    this.talkingBubbleEl = null;
    this.eyeRestScaleLeft = 1;
    this.eyeRestScaleRight = 1;
    this.waitingEyeSide = 'right';
    this.waitingSeedSource = '';
    this.waitingSeedCounter = 0;
    this.waitingBreathTween = null;
    this.isDestroyed = false;

    this.setup();
  }

  private setup(): void {
    if (!this.gsap) {
      return;
    }
    if (this.eyes) {
      this.gsap.set(this.eyes, { x: 0, y: 0 });
    }
    if (this.eyeLeft && this.eyeRight) {
      this.gsap.set([this.eyeLeft, this.eyeRight], {
        scaleY: 1,
        transformOrigin: 'center'
      });
    }
    if (this.mouth) {
      this.gsap.set(this.mouth, {
        scaleY: 1,
        scaleX: 1,
        y: 0,
        transformOrigin: 'center'
      });
    }
    if (this.mouthInner) {
      this.gsap.set(this.mouthInner, { opacity: 0 });
    }

    this.talkTimeline = null;
  }

  private log(message: string): void {
    if (!this.diagnostics) {
      return;
    }
    console.info(`[diagnostics] avatar ${message}`);
  }

  private resolveTalkCompletion(duration = 0): void {
    if (typeof this.talkCompletion !== 'function') {
      return;
    }
    const callback = this.talkCompletion;
    this.talkCompletion = null;
    this.talkDuration = 0;
    callback(duration);
  }

  private setState(nextState: AnimatorState): void {
    if (this.state === nextState) {
      return;
    }
    this.state = nextState;
    if (!this.diagnostics) {
      return;
    }
    const message =
      nextState === 'waiting'
        ? 'avatar state: waiting (looking forward)'
        : `avatar state: ${nextState}`;
    console.info(`[diagnostics] ${message}`);
  }

  private setSpeechProfile(input: string | number): void {
    let length = 0;
    let sentenceCount = 0;
    if (typeof input === 'string') {
      length = input.length;
      const matches = input.match(/[.!?]/g);
      sentenceCount = matches ? matches.length : 0;
    } else if (Number.isFinite(input)) {
      length = input;
    }
    const normalized = length > 0 ? length / 120 : 0;
    this.speechIntensity = this.clamp(normalized, 0, 1);
    this.sentencePauseBias = Math.min(sentenceCount, 3);
  }

  private setWaitingSeedSource(messageId?: string): void {
    if (typeof messageId === 'string' && messageId.trim()) {
      this.waitingSeedSource = messageId;
      return;
    }
    this.waitingSeedCounter += 1;
    this.waitingSeedSource = `fallback-${this.waitingSeedCounter}`;
  }

  private createSeededRng(seedSource: string): () => number {
    let seed = this.hashString(seedSource || 'seed');
    return () => {
      seed += 0x6d2b79f5;
      let result = Math.imul(seed ^ (seed >>> 15), seed | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  private hashString(value: string): number {
    let hash = 2166136261;
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private randomInRange(rng: () => number, min: number, max: number): number {
    return min + (max - min) * rng();
  }

  private tokenizeText(text: string): string[] {
    if (typeof text !== 'string') {
      return [];
    }
    const tokens = text.match(/(\s+|[.,!?;:]+|[^\s.,!?;:]+)/g);
    return tokens ? tokens.filter(Boolean) : [];
  }

  private formatTokenPreview(tokens: string[], limit = 12): string {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return '';
    }
    return tokens
      .slice(0, limit)
      .map((token) => (/\s+/.test(token) ? '<ws>' : token))
      .join(' | ');
  }

  private buildTalkTimeline(text: string): { tokens: string[]; duration: number } {
    if (!this.gsap || !this.mouth) {
      return { tokens: [], duration: 0 };
    }
    if (this.talkTimeline) {
      this.talkTimeline.kill();
    }
    this.talkTimeline = this.gsap.timeline({
      paused: true,
      defaults: { ease: 'power1.inOut' }
    });

    const tokens = this.tokenizeText(text);
    let duration = this.addTokensToTimeline(tokens, this.talkTimeline);
    if (duration === 0) {
      duration = this.addWordToTimeline('hi', this.talkTimeline);
    }

    return { tokens, duration };
  }

  private addTokensToTimeline(tokens: string[], timeline: GSAPTimeline): number {
    if (!timeline) {
      return 0;
    }
    let total = 0;
    let hasWord = false;
    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        const pause = this.randomFloat(0.04, 0.1);
        this.addPauseDuration(timeline, pause);
        total += pause;
        continue;
      }
      if (/^[.,!?;:]+$/.test(token)) {
        const isSentence = /[.!?]/.test(token);
        let pause = isSentence
          ? this.randomFloat(0.16, 0.28)
          : this.randomFloat(0.1, 0.18);
        if (isSentence && this.sentencePauseBias > 0) {
          pause += this.randomFloat(0.02, 0.05) * this.sentencePauseBias;
        }
        this.addPauseDuration(timeline, pause);
        total += pause;
        continue;
      }
      hasWord = true;
      total += this.addWordToTimeline(token, timeline);
    }
    if (!hasWord) {
      total += this.addWordToTimeline('hi', timeline);
    }
    return total;
  }

  private addWordToTimeline(word: string, timeline: GSAPTimeline): number {
    if (!timeline) {
      return 0;
    }
    const wordLength = this.getWordLength(word);
    const wordDuration = this.getWordDuration(wordLength);
    const syllables = this.getSyllableCount(wordLength);
    const restDurations: number[] = [];
    for (let i = 0; i < syllables - 1; i += 1) {
      restDurations.push(Math.random() < 0.3 ? this.randomFloat(0.03, 0.06) : 0);
    }
    let restTotal = restDurations.reduce((sum, value) => sum + value, 0);
    const maxRest = wordDuration * 0.35;
    if (restTotal > maxRest && restTotal > 0) {
      const scale = maxRest / restTotal;
      for (let i = 0; i < restDurations.length; i += 1) {
        restDurations[i] *= scale;
      }
      restTotal = maxRest;
    }
    let perSyllable = (wordDuration - restTotal) / syllables;
    perSyllable = this.clamp(perSyllable, 0.05, 0.16);

    let total = 0;
    for (let i = 0; i < syllables; i += 1) {
      const duration = this.applyTimingJitter(perSyllable, 0.15, 0.05, 0.18);
      const preset = this.pickVisemePreset();
      this.addVisemeStep(timeline, preset, duration);
      total += duration;
      if (i < syllables - 1 && restDurations[i] > 0) {
        this.addPauseDuration(timeline, restDurations[i]);
        total += restDurations[i];
      }
    }
    return total;
  }

  private getWordLength(word: string): number {
    if (typeof word !== 'string') {
      return 0;
    }
    const stripped = word.replace(/[^a-z0-9]/gi, '');
    return stripped.length || word.length;
  }

  private getWordDuration(length: number): number {
    const base = 0.1 + 0.02 * Math.min(length, 10);
    return this.clamp(base, 0.14, 0.34);
  }

  private getSyllableCount(length: number): number {
    if (length <= 3) {
      return 1;
    }
    if (length <= 6) {
      return 2;
    }
    return 3;
  }

  private pickVisemePreset(): VisemePreset {
    const intensity = this.speechIntensity;
    const smallWeight = 0.55 - intensity * 0.08;
    const medWeight = 0.3 + intensity * 0.08;
    const closedWeight = 0.12 - intensity * 0.04;
    const wideWeight = 0.03 + intensity * 0.04;
    const presets: VisemePreset[] = [
      {
        name: 'small',
        weight: Math.max(0.2, smallWeight),
        scaleY: [1.2, 1.35],
        scaleX: [1.02, 1.06],
        y: [-0.35, -0.15],
        innerOpacity: [0.08, 0.14]
      },
      {
        name: 'medium',
        weight: Math.max(0.15, medWeight),
        scaleY: [1.45, 1.65],
        scaleX: [1.06, 1.12],
        y: [-0.75, -0.45],
        innerOpacity: [0.22, 0.32]
      },
      {
        name: 'closed',
        weight: Math.max(0.08, closedWeight),
        scaleY: [0.82, 0.9],
        scaleX: [0.98, 1.02],
        y: [-0.05, 0.05],
        innerOpacity: [0, 0]
      },
      {
        name: 'wide',
        weight: Math.max(0.02, wideWeight),
        scaleY: [1.7, 1.9],
        scaleX: [1.1, 1.18],
        y: [-1, -0.75],
        innerOpacity: [0.32, 0.45]
      }
    ];
    const totalWeight = presets.reduce((sum, preset) => sum + (preset.weight || 0), 0);
    let pick = Math.random() * totalWeight;
    for (const preset of presets) {
      if (pick <= (preset.weight || 0)) {
        return preset;
      }
      pick -= preset.weight || 0;
    }
    return presets[0];
  }

  private addVisemeStep(timeline: GSAPTimeline, preset: VisemePreset, duration: number): void {
    if (!timeline || !preset || !this.mouth) {
      return;
    }
    const shape = this.resolveVisemeShape(preset);
    timeline.to(
      this.mouth,
      {
        duration,
        scaleY: shape.scaleY,
        scaleX: shape.scaleX,
        y: shape.y
      },
      '>'
    );
    if (this.mouthInner) {
      timeline.to(
        this.mouthInner,
        {
          duration,
          opacity: shape.innerOpacity
        },
        '<'
      );
    }
  }

  private addPauseDuration(timeline: GSAPTimeline, duration: number): void {
    const restPreset: VisemePreset = {
      scaleY: [0.88, 0.94],
      scaleX: [0.98, 1.02],
      y: [-0.02, 0.02],
      innerOpacity: [0, 0]
    };
    this.addVisemeStep(timeline, restPreset, duration);
  }

  private addIdleTail(timeline: GSAPTimeline): void {
    if (!timeline || !this.mouth) {
      return;
    }
    const idleDuration = this.randomFloat(0.6, 0.8);
    timeline.to(
      this.mouth,
      {
        duration: idleDuration,
        scaleY: 1.02,
        scaleX: 1.01,
        y: -0.15,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      },
      '>'
    );
    if (this.mouthInner) {
      timeline.to(
        this.mouthInner,
        {
          duration: idleDuration,
          opacity: 0,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true
        },
        '<'
      );
    }
  }

  private resolveVisemeShape(preset: VisemePreset): VisemeShape {
    const scaleY = this.clamp(
      this.randomFromRange(preset.scaleY),
      0.75,
      1.9
    );
    const scaleX = this.clamp(
      this.randomFromRange(preset.scaleX),
      0.95,
      1.22
    );
    const y = this.clamp(this.randomFromRange(preset.y), -1.5, 0.5);
    const innerOpacity = this.mouthInner
      ? this.clamp(this.randomFromRange(preset.innerOpacity), 0, 0.45)
      : 0;
    return { scaleY, scaleX, y, innerOpacity };
  }

  private randomFromRange(value: number[] | number): number {
    if (Array.isArray(value)) {
      return this.randomFloat(value[0], value[1]);
    }
    return value;
  }

  private applyTimingJitter(duration: number, percent: number, min: number, max: number): number {
    const delta = duration * percent;
    return this.clamp(this.randomFloat(duration - delta, duration + delta), min, max);
  }

  startIdle(): void {
    this.startBlinking();
    this.stopTalkingAndReset();
    this.lookCenter();
  }

  startTalking(textOrLength: string | number, bubbleEl?: HTMLElement | null, messageId?: string, options: TalkingOptions = {}): number {
    this.startBlinking();
    this.resolveTalkCompletion(0);
    const text = typeof textOrLength === 'string' ? textOrLength : '';
    this.talkingBubbleEl = bubbleEl || null;
    this.setWaitingSeedSource(messageId);
    this.setSpeechProfile(textOrLength);
    if (this.state === 'waiting') {
      this.exitWaiting('talking');
    } else {
      this.setState('talking');
    }
    this.isTalking = true;
    this.lastTalkText = text;
    this.clearWaitingExpression();
    const { tokens, duration } = this.buildTalkTimeline(text);
    this.talkDuration = duration;
    this.talkCompletion =
      typeof options.onComplete === 'function' ? options.onComplete : null;
    if (this.diagnostics) {
      const preview = this.formatTokenPreview(tokens) || '<none>';
      this.log(`tokens ${preview}`);
      this.log(`talk duration ${duration.toFixed(2)}s`);
    }
    if (this.talkTimeline) {
      this.talkTimeline.eventCallback('onComplete', () => {
        if (this.state === 'talking') {
          this.enterWaiting();
        }
        this.resolveTalkCompletion(duration);
      });
      this.talkTimeline.play(0);
      return duration;
    }
    if (this.state === 'talking') {
      this.enterWaiting();
    }
    this.resolveTalkCompletion(duration);
    return duration;
  }

  stopTalkingAndReset(): void {
    const wasTalking = this.isTalking;
    this.isTalking = false;
    this.exitWaiting('idle');
    this.resolveTalkCompletion(0);
    if (wasTalking) {
      this.log('talk stop');
    }
    this.talkingBubbleEl = null;
    if (!this.gsap || !this.mouth) {
      return;
    }
    if (this.talkTimeline) {
      this.talkTimeline.kill();
      this.talkTimeline = null;
    }
    this.clearWaitingExpression();
    this.gsap.to(this.mouth, {
      duration: 0.16,
      scaleY: 1,
      scaleX: 1,
      y: 0,
      rotation: 0,
      ease: 'power1.out'
    });
    if (this.mouthInner) {
      this.gsap.to(this.mouthInner, {
        duration: 0.16,
        opacity: 0,
        ease: 'power1.out'
      });
    }
  }

  private enterWaiting(): void {
    if (!this.gsap || !this.mouth || !this.eyeLeft || !this.eyeRight) {
      return;
    }
    this.isTalking = false;
    this.setState('waiting');
    if (this.talkTimeline) {
      this.talkTimeline.kill();
      this.talkTimeline = null;
    }
    if (this.waitingBreathTween) {
      this.waitingBreathTween.kill();
      this.waitingBreathTween = null;
    }
    const rng = this.createSeededRng(this.waitingSeedSource);
    const eyeSide = rng() < 0.7 ? 'right' : 'left';
    this.waitingEyeSide = eyeSide;
    this.lookDirection = 'center';
    if (this.lookTween) {
      this.lookTween.kill();
      this.lookTween = null;
    }
    this.gsap.to(this.eyes, {
      duration: 0.18,
      x: 0,
      y: 0,
      ease: 'power2.out',
      overwrite: 'auto'
    });
    const squintScale = this.randomInRange(rng, 0.55, 0.72);
    const squintY = this.randomInRange(rng, 0.4, 0.8);
    const smileScaleX = this.randomInRange(rng, 1.02, 1.06);
    const smileScaleY = this.randomInRange(rng, 0.92, 0.98);
    const smileY = this.randomInRange(rng, -0.8, -0.3);
    const smileRotation = this.randomInRange(rng, -1, 1);
    const breathY = this.randomInRange(rng, 0.1, 0.4);
    const breathScaleX = this.randomInRange(rng, 0.005, 0.015);
    const breathDuration = this.randomInRange(rng, 2.8, 4.5);
    this.eyeRestScaleLeft = eyeSide === 'left' ? squintScale : 1;
    this.eyeRestScaleRight = eyeSide === 'right' ? squintScale : 1;

    const squintEye = eyeSide === 'left' ? this.eyeLeft : this.eyeRight;
    const otherEye = eyeSide === 'left' ? this.eyeRight : this.eyeLeft;
    this.gsap.killTweensOf([squintEye, otherEye, this.mouth, this.mouthInner]);

    this.gsap.to(squintEye, {
      duration: 0.18,
      scaleY: squintScale,
      y: squintY,
      ease: 'power2.out',
      overwrite: 'auto'
    });
    this.gsap.to(otherEye, {
      duration: 0.18,
      scaleY: 1,
      y: 0,
      ease: 'power2.out',
      overwrite: 'auto'
    });
    this.gsap.to(this.mouth, {
      duration: 0.18,
      scaleY: smileScaleY,
      scaleX: smileScaleX,
      y: smileY,
      rotation: smileRotation,
      ease: 'power2.out',
      overwrite: 'auto'
    });
    if (this.mouthInner) {
      this.gsap.to(this.mouthInner, {
        duration: 0.18,
        opacity: 0,
        ease: 'power2.out',
        overwrite: 'auto'
      });
    }
    this.waitingBreathTween = this.gsap.to(this.mouth, {
      duration: breathDuration,
      y: smileY + breathY,
      scaleX: smileScaleX + breathScaleX,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });
    if (this.diagnostics) {
      this.log(`waitingEye=${eyeSide}`);
      this.log(`squintScaleY=${squintScale.toFixed(2)}`);
      this.log(
        `smile scaleX=${smileScaleX.toFixed(2)} y=${smileY.toFixed(2)} rot=${smileRotation.toFixed(2)}`
      );
    }
  }

  private exitWaiting(nextState: AnimatorState = 'idle'): void {
    if (this.state !== 'waiting') {
      if (nextState !== this.state) {
        this.setState(nextState);
      }
      return;
    }
    this.clearWaitingExpression();
    this.setState(nextState);
  }

  private clearWaitingExpression(): void {
    if (!this.gsap || !this.eyeLeft || !this.eyeRight) {
      this.eyeRestScaleLeft = 1;
      this.eyeRestScaleRight = 1;
      return;
    }
    if (this.waitingBreathTween) {
      this.waitingBreathTween.kill();
      this.waitingBreathTween = null;
    }
    this.eyeRestScaleLeft = 1;
    this.eyeRestScaleRight = 1;
    this.gsap.killTweensOf([
      this.eyeLeft,
      this.eyeRight,
      this.mouth,
      this.mouthInner
    ]);
    this.gsap.to(this.eyeLeft, {
      duration: 0.12,
      scaleY: 1,
      y: 0,
      ease: 'power1.out',
      overwrite: 'auto'
    });
    this.gsap.to(this.eyeRight, {
      duration: 0.12,
      scaleY: 1,
      y: 0,
      ease: 'power1.out',
      overwrite: 'auto'
    });
    if (this.mouth) {
      this.gsap.set(this.mouth, { rotation: 0 });
    }
  }

  lookAtBubble(bubbleEl: HTMLElement | null): void {
    if (this.state === 'waiting') {
      return;
    }
    if (!bubbleEl || !this.avatar || !this.eyes) {
      this.lookCenter();
      return;
    }
    const bubbleRect = bubbleEl.getBoundingClientRect();
    const avatarRect = this.avatar.getBoundingClientRect();
    if (!bubbleRect.width || !avatarRect.width) {
      this.lookCenter();
      return;
    }

    const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
    const avatarCenterX = avatarRect.left + avatarRect.width / 2;
    const deltaX = bubbleCenterX - avatarCenterX;
    if (deltaX > this.lookThreshold) {
      this.lookAt('right');
    } else if (deltaX < -this.lookThreshold) {
      this.lookAt('left');
    } else {
      this.lookAt('center');
    }
  }

  lookCenter(): void {
    this.lookAt('center');
  }

  private lookAt(direction: LookDirection): void {
    const safeDirection: LookDirection = ['left', 'right', 'center'].includes(direction)
      ? direction
      : 'center';
    if (this.lookDirection === safeDirection) {
      return;
    }
    this.lookDirection = safeDirection;
    this.log(`look ${safeDirection}`);
    const offsetX =
      safeDirection === 'left'
        ? -this.lookOffsetPx
        : safeDirection === 'right'
          ? this.lookOffsetPx
          : 0;
    if (!this.gsap || !this.eyes) {
      return;
    }
    if (this.lookTween) {
      this.lookTween.kill();
    }
    this.lookTween = this.gsap.to(this.eyes, {
      x: offsetX,
      y: 0,
      duration: 0.18,
      ease: 'power2.out'
    });
  }

  startBlinking(): void {
    if (this.blinking) {
      return;
    }
    this.blinking = true;
    this.scheduleBlink();
  }

  private stopBlinking(): void {
    this.blinking = false;
    if (this.blinkTimer) {
      window.clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
    if (this.blinkTimeline) {
      this.blinkTimeline.kill();
      this.blinkTimeline = null;
    }
  }

  private scheduleBlink(): void {
    if (this.isDestroyed || !this.blinking) {
      return;
    }
    const delayMs = this.getBlinkDelay();
    this.blinkTimer = window.setTimeout(() => {
      this.blinkTimer = null;
      this.playBlink();
    }, delayMs);
  }

  private playBlink(): void {
    if (this.isDestroyed) {
      return;
    }
    this.log('blink');
    if (!this.gsap || !this.eyeLeft || !this.eyeRight) {
      this.scheduleBlink();
      return;
    }
    if (this.blinkTimeline) {
      this.blinkTimeline.kill();
    }
    const downDuration = this.randomBetween(60, 90) / 1000;
    const upDuration = this.randomBetween(60, 90) / 1000;
    const closedScale = this.randomFloat(0.12, 0.2);
    const leftRest = this.eyeRestScaleLeft || 1;
    const rightRest = this.eyeRestScaleRight || 1;
    this.blinkTimeline = this.gsap.timeline({
      onComplete: () => this.scheduleBlink()
    });
    this.blinkTimeline
      .to([this.eyeLeft, this.eyeRight], {
        duration: downDuration,
        scaleY: closedScale,
        ease: 'power1.out',
        overwrite: 'auto'
      })
      .to(
        this.eyeLeft,
        {
          duration: upDuration,
          scaleY: leftRest,
          ease: 'power1.out',
          overwrite: 'auto'
        },
        '>'
      )
      .to(
        this.eyeRight,
        {
          duration: upDuration,
          scaleY: rightRest,
          ease: 'power1.out',
          overwrite: 'auto'
        },
        '<'
      );
  }

  private getBlinkDelay(): number {
    if (this.isTalking) {
      return this.randomBetween(1800, 4200);
    }
    return this.randomBetween(2200, 5200);
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  destroy(): void {
    this.isDestroyed = true;
    this.stopBlinking();
    this.resolveTalkCompletion(0);
    if (this.lookTween) {
      this.lookTween.kill();
      this.lookTween = null;
    }
    if (this.talkTimeline) {
      this.talkTimeline.kill();
      this.talkTimeline = null;
    }
    if (this.waitingBreathTween) {
      this.waitingBreathTween.kill();
      this.waitingBreathTween = null;
    }
    if (this.gsap) {
      this.gsap.killTweensOf([
        this.eyes,
        this.eyeLeft,
        this.eyeRight,
        this.mouth,
        this.mouthInner
      ]);
    }
  }
}

// Exposed on window for the overlay's <script> tag loader. Guarded so the module
// can also be required from a plain Node test runner.
if (typeof window !== 'undefined') {
  window.AvatarAnimator = AvatarAnimator;
}
