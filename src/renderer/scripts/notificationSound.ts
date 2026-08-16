/**
 * Notification sound player for the overlay.
 * Plays audio when new messages appear.
 */

/** Allowed audio file extensions */
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'];

/** Default sound file (bundled with app) */
const DEFAULT_SOUND_FILE = './assets/sounds/notification.wav';

interface NotificationSoundOptions {
  /** Whether sound is enabled. */
  enabled: boolean;
  /** Sound file path (full path or empty for default). */
  soundFile: string;
  /** Volume level (0-100). */
  volume: number;
  /** Audio output device ID (empty string for system default). */
  deviceId?: string;
  /** Enable diagnostic logging. */
  diagnostics?: boolean;
}

/**
 * Validates if a file has an allowed audio extension.
 */
function isValidAudioFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

/**
 * Notification sound player class.
 */
export class NotificationSound {
  private enabled: boolean;
  private volume: number;
  private deviceId: string;
  private soundFile: string;
  private audio: HTMLAudioElement | null = null;
  private diagnostics: boolean;

  constructor(options: NotificationSoundOptions) {
    this.enabled = options.enabled;
    this.volume = Math.max(0, Math.min(100, options.volume)) / 100;
    this.deviceId = options.deviceId || '';
    // Remembered so sound enabled later (tray unmute) can still be loaded.
    this.soundFile = options.soundFile || DEFAULT_SOUND_FILE;
    this.diagnostics = Boolean(options.diagnostics);

    if (this.enabled) {
      this.loadSound(this.soundFile);
    }
  }

  /**
   * Load the sound file.
   */
  private loadSound(soundFile: string): void {
    if (!isValidAudioFile(soundFile)) {
      this.log(`Invalid audio file extension: ${soundFile}`);
      this.enabled = false;
      return;
    }

    // Determine the audio source path
    let soundPath: string;
    if (soundFile.startsWith('/') || soundFile.match(/^[a-zA-Z]:\\/)) {
      // Absolute path (Unix or Windows)
      soundPath = `file://${soundFile}`;
    } else if (soundFile.startsWith('./') || soundFile.startsWith('../')) {
      // Relative path (internal)
      soundPath = soundFile;
    } else {
      // Legacy: just filename, look in assets/sounds
      soundPath = `./assets/sounds/${soundFile}`;
    }

    this.log(`Loading sound: ${soundPath}`);

    this.audio = new Audio(soundPath);
    this.audio.volume = this.volume;

    // Set audio output device if specified
    if (this.deviceId) {
      void this.setAudioDevice(this.deviceId);
    }

    // Pre-load the audio
    this.audio.load();

    this.audio.addEventListener('error', (e) => {
      this.log(`Failed to load sound: ${soundPath}`);
      console.error('Audio load error:', e);
      this.enabled = false;
    });

    this.audio.addEventListener('canplaythrough', () => {
      this.log(`Sound loaded successfully: ${soundPath}`);
    });
  }

  /**
   * Set the audio output device.
   * Uses setSinkId() which is supported in Chromium-based browsers (including Electron).
   */
  private async setAudioDevice(deviceId: string): Promise<void> {
    if (!this.audio) return;

    // Check if setSinkId is available (Chromium feature)
    const audioElement = this.audio as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>;
    };

    if (typeof audioElement.setSinkId === 'function') {
      try {
        await audioElement.setSinkId(deviceId);
        this.log(`Audio output set to device: ${deviceId}`);
      } catch (err) {
        this.log(`Failed to set audio device: ${String(err)}`);
        console.error('setSinkId error:', err);
      }
    } else {
      this.log('setSinkId not supported in this browser');
    }
  }

  /**
   * Play the notification sound.
   */
  play(): void {
    if (!this.enabled || !this.audio) {
      return;
    }

    this.log('Playing notification sound');

    // Reset to start if already playing
    this.audio.currentTime = 0;
    this.audio.play().catch((err: unknown) => {
      this.log(`Failed to play sound: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /**
   * Update volume level.
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume)) / 100;
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  /**
   * Enable or disable sound.
   *
   * Loads the audio on first enable: an overlay created with sound disabled has
   * no audio element, and the tray's Unmute would otherwise be a no-op forever.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (enabled && !this.audio) {
      // loadSound flips `enabled` back off if the file is unusable.
      this.loadSound(this.soundFile);
    }
  }

  /**
   * Whether a sound is currently loaded and playable.
   */
  isReady(): boolean {
    return this.enabled && this.audio !== null;
  }

  /**
   * Log diagnostic messages.
   */
  private log(message: string): void {
    if (this.diagnostics) {
      console.info(`[NotificationSound] ${message}`);
    }
  }
}

// Expose to window for use in HTML script. Guarded so the module can also be
// required from a plain Node test runner.
if (typeof window !== 'undefined') {
  window.NotificationSound = NotificationSound;
}
