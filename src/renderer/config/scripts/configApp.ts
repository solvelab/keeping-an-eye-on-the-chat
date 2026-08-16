/**
 * Configuration window application controller.
 * Renders the form from schema and handles user interactions.
 */

/// <reference path="./global.d.ts" />

// Type-only imports: they are erased at compile time, so no require() reaches
// the browser. A value import here would fail at runtime and tsc would not say so.
import type { AppConfig, ConfigPreset, ConfigSection, ConfigSource, SerializableFieldMeta, ValidationErrors } from '../../../config/types';
import type { Platform } from '../../../shared/platforms';

type Language = 'en' | 'pt';

/** A configuration field name. */
type ConfigKey = keyof AppConfig;

/**
 * A language table. The keys come from src/renderer/config/locales/*.json, which
 * scripts/copy-assets.js turns into a <script> tag — the wizard has no module
 * loader and runs from a file:// URL, where Chromium blocks fetch and XHR, so a
 * script tag is the only way to get data into the page.
 *
 * Kept as an index signature rather than a hand-written field list: the fields
 * would be a second copy of the JSON, and a test already asserts that both
 * locales carry every key the wizard asks for.
 */
type Translations = Record<string, string>;

/** Every language the wizard ships, keyed by language code. */
function loadTranslations(): Record<Language, Translations> {
  const bundle = window.configTranslations;

  if (!bundle || !bundle.en) {
    throw new Error(
      'Translations are missing. scripts/copy-assets.js generates ' +
        'dist/renderer/config/scripts/translations.js from the locale JSON files.'
    );
  }

  return bundle;
}

const TRANSLATIONS: Record<Language, Translations> = loadTranslations();

/**
 * Get the initial language preference from browser settings.
 * Used only on first run before config is loaded.
 */
function getInitialLanguage(): Language {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('pt')) {
    return 'pt';
  }
  return 'en';
}

/**
 * Main configuration application class.
 */
class ConfigApp {
  private schema: Partial<Record<keyof AppConfig, SerializableFieldMeta>> = {};
  private sections: readonly ConfigSection[] = [];
  private sectionMeta: Partial<Record<ConfigSection, { title: string; description: string }>> = {};
  private presets: ConfigPreset[] = [];
  private config: AppConfig = {} as AppConfig;
  private sources: Partial<Record<keyof AppConfig, ConfigSource>> = {};
  private originalConfig: AppConfig = {} as AppConfig;
  private errors: ValidationErrors = {};
  private isDirty = false;
  private isFirstRun = false;
  private currentLang: Language = getInitialLanguage();
  private t: Translations = TRANSLATIONS[this.currentLang];
  /** The live bubble in the overlay section, rebuilt with the form. */
  private preview: import('./bubblePreview').BubblePreview | null = null;

  /**
   * Initialize the application.
   */
  async init(): Promise<void> {
    try {
      // Apply initial translations to static elements
      this.applyStaticTranslations();
      this.updateLanguageToggle();

      // Check if configAPI is available
      if (!window.configAPI) {
        console.error('configAPI not available - preload may have failed');
        this.showAlert('error', this.t.msgApiNotAvailable);
        return;
      }

      console.log('Loading schema...');
      // Load schema and presets
      const schemaData = await window.configAPI.getSchema();
      console.log('Schema loaded:', schemaData);
      this.schema = schemaData.schema;
      this.sections = schemaData.sections;
      this.sectionMeta = schemaData.sectionMeta;
      this.presets = [...schemaData.presets];

      // Load saved config
      const loadResult = await window.configAPI.load();
      this.config = { ...loadResult.config };
      this.sources = loadResult.sources;
      this.originalConfig = { ...loadResult.config };
      this.isFirstRun = loadResult.isFirstRun;

      // Apply language from loaded config (if different from initial detection)
      if (this.config.language && this.config.language !== this.currentLang) {
        this.currentLang = this.config.language;
        this.t = TRANSLATIONS[this.currentLang];
        this.applyStaticTranslations();
        this.updateLanguageToggle();
      }

      if (loadResult.loadError) {
        this.showAlert('warning', loadResult.loadError);
      }

      if (this.isFirstRun) {
        this.showAlert('info', this.t.msgWelcome);
      }

      // Render UI
      this.renderPresets();
      this.renderSections();
      this.bindEvents();
      await this.validateAndUpdate();

      // Focus the first required field
      this.focusFirstRequiredField();
    } catch (err) {
      console.error('Failed to initialize config app:', err);
      const message = err instanceof Error ? err.message : String(err);
      this.showAlert('error', `${this.t.msgLoadFailed} ${message}`);
    }
  }

  /**
   * Apply translations to static HTML elements.
   */
  private applyStaticTranslations(): void {
    const setTextById = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    // Header
    setTextById('headerTitle', this.t.appTitle);
    setTextById('headerSubtitle', this.t.appSubtitle);

    // Sections
    setTextById('sectionBasicTitle', this.t.sectionBasic);
    setTextById('sectionOverlayTitle', this.t.sectionOverlay);
    setTextById('sectionSoundTitle', this.t.sectionSound);
    setTextById('sectionPerformanceTitle', this.t.sectionPerformance);
    setTextById('sectionAdvancedTitle', this.t.sectionAdvanced);

    // Quick Setup
    setTextById('quickSetupLabel', this.t.quickSetup);
    setTextById('selectPresetOption', this.t.selectPreset);

    // Buttons
    setTextById('resetBtnText', this.t.btnReset);
    setTextById('cancelBtnText', this.t.btnCancel);
    setTextById('startBtnText', this.t.btnStart);

    // Modal
    setTextById('modalText', this.t.msgTestingConnection);
  }

  /**
   * Update language toggle button states.
   */
  private updateLanguageToggle(): void {
    const buttons = document.querySelectorAll('.lang-btn');
    buttons.forEach((btn) => {
      const lang = (btn as HTMLElement).dataset.lang;
      btn.classList.toggle('active', lang === this.currentLang);
    });
  }

  /**
   * Change language and re-render UI.
   */
  private changeLanguage(lang: Language): void {
    if (lang === this.currentLang) return;

    this.currentLang = lang;
    this.t = TRANSLATIONS[lang];

    // Update config with new language preference
    this.config.language = lang;
    this.isDirty = true;

    // Re-apply translations
    this.applyStaticTranslations();
    this.updateLanguageToggle();

    // Re-render dynamic content
    this.clearSections();
    this.renderPresets();
    this.renderSections();
    void this.validateAndUpdate();
  }

  /**
   * Clear section content for re-rendering.
   */
  private clearSections(): void {
    for (const section of this.sections) {
      const container = document.getElementById(`section-${section}`);
      if (container) {
        container.innerHTML = '';
      }
    }
    // Clear preset options (except the first placeholder)
    const select = document.getElementById('presetSelect') as HTMLSelectElement;
    if (select) {
      while (select.options.length > 1) {
        select.remove(1);
      }
    }
  }

  /**
   * Get translated preset name.
   */
  private getPresetName(presetId: string): string {
    const map: Record<string, keyof Translations> = {
      default: 'presetDefault',
      'fast-chat': 'presetFastPaced',
      cozy: 'presetCozy',
    };
    const key = map[presetId];
    return key ? this.t[key] : presetId;
  }

  /**
   * Get translated preset description.
   */
  private getPresetDesc(presetId: string): string {
    const map: Record<string, keyof Translations> = {
      default: 'presetDefaultDesc',
      'fast-chat': 'presetFastPacedDesc',
      cozy: 'presetCozyDesc',
    };
    const key = map[presetId];
    return key ? this.t[key] : '';
  }

  /**
   * Render presets dropdown.
   */
  private renderPresets(): void {
    const select = document.getElementById('presetSelect') as HTMLSelectElement;
    if (!select) return;

    for (const preset of this.presets) {
      const option = document.createElement('option');
      option.value = preset.id;
      const name = this.getPresetName(preset.id);
      const desc = this.getPresetDesc(preset.id);
      option.textContent = `${name} - ${desc}`;
      select.appendChild(option);
    }
  }

  /**
   * Render all config sections.
   */
  private renderSections(): void {
    for (const section of this.sections) {
      const container = document.getElementById(`section-${section}`);
      if (!container) continue;

      const fields = this.schemaFields()
        .map(([, field]) => field)
        .filter((field) => field.section === section && field.key !== 'language');

      // A fresh renderer per pass, so switching language picks up the new table.
      const renderer = new window.configForm.ConfigFormRenderer({
        t: this.t,
        config: this.config,
        sources: this.sources,
        setConfigValue: (key, value) => this.setConfigValue(key, value),
        log: (message) => this.log(message),
      });

      for (const field of fields) {
        container.appendChild(renderer.createField(field));

        // Directly below the setting it exists to explain.
        if (field.key === 'authorStyle') {
          container.appendChild(this.buildPreview());
        }
      }
    }
  }

  /**
   * Fields that depend on notificationSoundEnabled being true.
   */
  /**
   * Narrow a DOM-derived string to a configuration key.
   *
   * Element ids carry field names as plain strings. This is the one place that
   * turns such a string back into a key the schema actually declares, so an id
   * that does not correspond to a field is rejected instead of writing a
   * phantom entry into the config.
   */
  private toConfigKey(key: string): ConfigKey | null {
    return Object.prototype.hasOwnProperty.call(this.schema, key) ? (key as ConfigKey) : null;
  }

  /** The schema as typed key/metadata pairs. */
  private schemaFields(): [ConfigKey, SerializableFieldMeta][] {
    return Object.entries(this.schema) as [ConfigKey, SerializableFieldMeta][];
  }

  /**
   * Write a coerced form value into the configuration.
   *
   * The cast is confined here: the value has just been coerced to the type the
   * schema declares for this key, which TypeScript cannot follow through the
   * DOM round trip.
   */
  private setConfigValue(key: ConfigKey, value: unknown): void {
    (this.config as unknown as Record<string, unknown>)[key] = value;
    this.refreshPreview();
  }

  /**
   * Build the bubble preview for the current render pass.
   *
   * The form is rebuilt from scratch whenever the language changes, so the
   * previous preview's rotation timer is stopped before a new one starts.
   */
  private buildPreview(): HTMLElement {
    this.preview?.destroy();
    this.preview = new window.bubblePreview.BubblePreview(this.t);
    this.refreshPreview();
    return this.preview.element;
  }

  /** Feed the preview the values that change what the bubble looks like. */
  private refreshPreview(): void {
    if (!this.preview) {
      return;
    }

    const configured: Platform[] = [];
    if (typeof this.config.twitchChatUrl === 'string' && this.config.twitchChatUrl.trim()) {
      configured.push('twitch');
    }
    if (typeof this.config.kickChatUrl === 'string' && this.config.kickChatUrl.trim()) {
      configured.push('kick');
    }

    this.preview.update({
      authorStyle: this.config.authorStyle,
      bubbleMaxWidth:
        typeof this.config.bubbleMaxWidth === 'number' ? this.config.bubbleMaxWidth : 420,
      platforms: configured,
    });
  }

  /**
   * Bind event listeners.
   */
  private bindEvents(): void {
    const form = document.getElementById('configForm');

    // Language toggle
    document.getElementById('languageToggle')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.lang-btn') as HTMLElement;
      if (btn && btn.dataset.lang) {
        this.changeLanguage(btn.dataset.lang as Language);
      }
    });

    // Form input changes
    form?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.handleInputChange(target);
    });

    form?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.handleInputChange(target);
    });

    // Form click events (delegated for dynamically created buttons)
    form?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Test connection button — which platform is carried on the button
      const urlField = window.configForm.chatUrlFieldOfButton(target);
      if (urlField) {
        void this.testConnection(urlField);
      }
      // Test sound button (delegated event)
      if (target.id === 'testSoundBtn' || target.closest('#testSoundBtn')) {
        void this.testSound();
      }
      // Select audio file button (delegated event)
      if (target.id === 'selectAudioBtn' || target.closest('#selectAudioBtn')) {
        void this.selectAudioFile();
      }
    });

    // Preset selection
    document.getElementById('presetSelect')?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      if (!select.value) {
        return;
      }
      const presetId = select.value;
      select.value = '';
      void this.applyPreset(presetId);
    });

    // Logo click - open GitHub profile in default browser
    document.getElementById('headerLogo')?.addEventListener('click', () => {
      window.configAPI.openExternal('https://github.com/solvelab');
    });

    // Donate button - open PayPal donation page
    document.getElementById('donateBtn')?.addEventListener('click', () => {
      window.configAPI.openExternal(
        'https://www.paypal.com/donate/?business=ZUADM4SZT5DC8&no_recurring=0&item_name=Projetos+desenvolvidos+com+cuidado+e+dedica%C3%A7%C3%A3o.+O+apoio+incentiva+a+continuidade+e+a+evolu%C3%A7%C3%A3o+constante.&currency_code=BRL'
      );
    });

    // Section toggles (collapsible sections)
    document.getElementById('overlayToggle')?.addEventListener('click', () => {
      this.toggleSection('overlay');
    });

    document.getElementById('soundToggle')?.addEventListener('click', () => {
      this.toggleSection('sound');
    });

    document.getElementById('performanceToggle')?.addEventListener('click', () => {
      this.toggleSection('performance');
    });

    document.getElementById('advancedToggle')?.addEventListener('click', () => {
      this.toggleSection('advanced');
    });

    // Reset button
    document.getElementById('resetBtn')?.addEventListener('click', () => {
      void this.resetToDefaults();
    });

    // Cancel button
    document.getElementById('cancelBtn')?.addEventListener('click', () => {
      this.handleCancel();
    });

    // Start button
    document.getElementById('startBtn')?.addEventListener('click', () => {
      void this.startOverlay();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl+Enter to start
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
        if (!startBtn.disabled) {
          void this.startOverlay();
        }
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        const modal = document.getElementById('connectionModal');
        if (modal && !modal.hidden) {
          // Modal is open, don't close window
          return;
        }
        this.handleCancel();
      }
    });
  }

  /**
   * Handle input value changes.
   */
  private handleInputChange(target: HTMLInputElement | HTMLSelectElement): void {
    const id = target.id;
    if (!id.startsWith('input-')) return;

    const key = this.toConfigKey(id.replace('input-', ''));
    if (!key) return;

    const meta = this.schema[key];
    if (!meta) return;

    let value: unknown;
    if (target.type === 'checkbox') {
      value = (target).checked;
    } else {
      // Form controls always yield strings; the schema decides the real type.
      value = window.configValues.coerceFieldValue(meta, target.value);
    }

    this.setConfigValue(key, value);
    this.isDirty = true;

    // Update dependent fields when sound enabled checkbox changes
    if (key === 'notificationSoundEnabled') {
      this.updateSoundDependentFields(Boolean(value));
    }

    void this.validateAndUpdate();
  }

  /**
   * Update the enabled/disabled state of sound-dependent fields.
   */
  private updateSoundDependentFields(soundEnabled: boolean): void {
    for (const fieldKey of window.configForm.SOUND_DEPENDENT_FIELDS) {
      const source = this.sources[fieldKey];
      const isOverridden = source === 'env' || source === 'cli';

      // Don't modify fields that are overridden by env/cli
      if (isOverridden) continue;

      const input = document.getElementById(`input-${fieldKey}`) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;

      if (input) {
        input.disabled = !soundEnabled;
      }
    }

    // Also update the test sound button
    const testSoundBtn = document.getElementById('testSoundBtn') as HTMLButtonElement | null;
    if (testSoundBtn) {
      testSoundBtn.disabled = !soundEnabled;
    }

    // Also update the select audio file button
    const selectAudioBtn = document.getElementById('selectAudioBtn') as HTMLButtonElement | null;
    if (selectAudioBtn) {
      selectAudioBtn.disabled = !soundEnabled;
    }
  }

  /**
   * Update form inputs from current config.
   */
  private updateFormFromConfig(): void {
    for (const [key, value] of Object.entries(this.config)) {
      const input = document.getElementById(`input-${key}`) as HTMLInputElement | null;
      if (!input) continue;

      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else if (Array.isArray(value)) {
        input.value = value.join(', ');
      } else {
        input.value = String(value ?? '');
      }

      // Update range value display if it's a slider
      if (input.type === 'range') {
        const valueDisplay = document.getElementById(`value-${key}`);
        if (valueDisplay) {
          valueDisplay.textContent = `${value ?? 0}%`;
        }
      }
    }

    // Update sound-dependent fields state based on current config
    this.updateSoundDependentFields(Boolean(this.config.notificationSoundEnabled));
  }

  /**
   * Validate config and update UI state.
   */
  private async validateAndUpdate(): Promise<void> {
    this.errors = await window.configAPI.validate(this.config);

    // Update error displays
    for (const key of Object.keys(this.schema) as ConfigKey[]) {
      const errorEl = document.getElementById(`error-${key}`);
      const inputEl = document.getElementById(`input-${key}`);

      if (errorEl) {
        errorEl.textContent = this.errors[key] || '';
      }

      if (inputEl) {
        inputEl.classList.toggle('form-input--error', Boolean(this.errors[key]));
      }
    }

    // Update start button
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const hasErrors = Object.keys(this.errors).length > 0;
    startBtn.disabled = hasErrors;
  }

  /**
   * Apply a preset configuration.
   */
  private async applyPreset(presetId: string): Promise<void> {
    const result = await window.configAPI.applyPreset(presetId);
    if (result.success) {
      // A preset only declares the knobs it cares about; everything else the
      // user has already typed — the Twitch URL above all — must survive.
      this.config = window.configValues.mergePresetConfig(this.config, result.config);
      this.updateFormFromConfig();
      await this.validateAndUpdate();
      this.isDirty = true;
      this.showAlert('success', this.t.msgPresetApplied);
    } else {
      this.showAlert('error', result.error || 'Failed to apply preset');
    }
  }

  /**
   * Toggle a collapsible section.
   */
  private toggleSection(sectionName: string): void {
    const button = document.getElementById(`${sectionName}Toggle`) as HTMLButtonElement;
    const section = button?.closest('.config-section');
    const content = document.getElementById(`section-${sectionName}`);
    const icon = button?.querySelector('.toggle-icon');

    if (!button || !content || !icon || !section) return;

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isExpanded));
    content.hidden = isExpanded;
    icon.textContent = isExpanded ? '+' : '-';
    section.classList.toggle('config-section--collapsed', isExpanded);
  }

  /**
   * Test that a platform's chat URL is reachable.
   *
   * The platform is derived from the URL by the main process, so this only has
   * to say which field was asked about.
   */
  private async testConnection(field: ConfigKey): Promise<void> {
    const url = this.config[field] as string;
    if (!url || !url.trim()) {
      this.showAlert('error', this.t.msgEnterUrlFirst);
      return;
    }

    const modal = document.getElementById('connectionModal');
    if (modal) modal.hidden = false;

    try {
      const result = await window.configAPI.testConnection(url);

      if (result.success) {
        this.showAlert('success', `${this.t.msgConnectionSuccess} (${result.latencyMs}ms)`);
      } else {
        this.showAlert('error', `${this.t.msgConnectionFailed} ${result.error}`);
      }
    } catch {
      this.showAlert('error', this.t.msgConnectionFailed);
    } finally {
      if (modal) modal.hidden = true;
    }
  }

  /**
   * Test notification sound with current settings.
   */
  private async testSound(): Promise<void> {
    const soundFile = this.config.notificationSoundFile || '';
    const volume = this.config.notificationSoundVolume ?? 50;
    const deviceId = this.config.notificationSoundDevice || '';

    // Determine the audio source path
    let audioSrc: string;
    if (!soundFile) {
      // No file selected, use default
      audioSrc = '../assets/sounds/notification.wav';
    } else if (soundFile.startsWith('/') || soundFile.match(/^[a-zA-Z]:\\/)) {
      // Absolute path (Unix or Windows)
      audioSrc = `file://${soundFile}`;
    } else {
      // Relative path (legacy support)
      audioSrc = `../assets/sounds/${soundFile}`;
    }

    try {
      // Create audio element for testing
      const audio = new Audio(audioSrc);
      audio.volume = volume / 100;

      // Set audio output device if supported and specified
      if (deviceId) {
        const audioWithSink = audio as HTMLAudioElement & {
          setSinkId?: (sinkId: string) => Promise<void>;
        };
        if (typeof audioWithSink.setSinkId === 'function') {
          await audioWithSink.setSinkId(deviceId);
        }
      }

      await audio.play();
    } catch (err) {
      console.error('Failed to play test sound:', err);
    }
  }

  /**
   * Open file dialog to select an audio file.
   */
  private async selectAudioFile(): Promise<void> {
    try {
      const result = await window.configAPI.selectAudioFile();

      if (result.success && result.filePath) {
        // Update the config with the full path
        this.config.notificationSoundFile = result.filePath;
        this.isDirty = true;

        // Update the display input
        const input = document.getElementById('input-notificationSoundFile') as HTMLInputElement;
        if (input) {
          input.value = result.filePath;
        }

        await this.validateAndUpdate();
      }
    } catch (err) {
      console.error('Failed to select audio file:', err);
    }
  }

  /**
   * Reset configuration to defaults.
   */
  private async resetToDefaults(): Promise<void> {
    if (!confirm(this.t.msgResetConfirm)) {
      return;
    }

    const defaults = await window.configAPI.getDefaults();
    this.config = { ...defaults };
    this.updateFormFromConfig();
    await this.validateAndUpdate();
    this.isDirty = true;
    this.showAlert('info', this.t.msgResetDefaults);
  }

  /**
   * Handle cancel button click.
   */
  private handleCancel(): void {
    if (this.isDirty) {
      if (!confirm(this.t.msgDiscardChanges)) {
        return;
      }
    }
    window.close();
  }

  /**
   * Start the overlay with current configuration.
   */
  private async startOverlay(): Promise<void> {
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const startBtnText = document.getElementById('startBtnText');
    startBtn.disabled = true;
    if (startBtnText) startBtnText.textContent = this.t.btnStarting;

    // Restore the button unless the overlay actually started. Previously this
    // only happened when `errors` was present, so a `{ success: false }`
    // without them left the wizard stuck on "Starting..." forever.
    const restoreStartButton = (): void => {
      startBtn.disabled = false;
      if (startBtnText) startBtnText.textContent = this.t.btnStart;
    };

    try {
      const result = await window.configAPI.start(this.config);

      if (result.success) {
        window.configAPI.notifyStarted();
        return;
      }

      if (result.errors) {
        this.errors = result.errors;
        for (const [key, error] of Object.entries(result.errors)) {
          const errorEl = document.getElementById(`error-${key}`);
          if (errorEl) errorEl.textContent = error;
        }
        this.showAlert('error', this.t.msgFixErrors);
      } else {
        this.showAlert('error', this.t.msgStartFailed);
      }

      restoreStartButton();
    } catch {
      this.showAlert('error', this.t.msgStartFailed);
      restoreStartButton();
    }
  }

  /**
   * Focus the first required field that's empty.
   */
  private focusFirstRequiredField(): void {
    for (const [key, meta] of this.schemaFields()) {
      if (meta.required && !this.config[key]) {
        const input = document.getElementById(`input-${key}`);
        if (input) {
          input.focus();
          break;
        }
      }
    }
  }

  /**
   * Log diagnostic messages.
   */
  private log(message: string): void {
    // Only log in development or when diagnostics are enabled
    if (window.configAPI) {
      console.info(`[ConfigApp] ${message}`);
    }
  }

  /**
   * Show an alert message.
   */
  private showAlert(type: 'error' | 'warning' | 'success' | 'info', message: string): void {
    const container = document.getElementById('alerts');
    if (!container) return;

    const alert = document.createElement('div');
    alert.className = `alert alert--${type}`;
    alert.textContent = message;

    container.innerHTML = '';
    container.appendChild(alert);

    // Auto-dismiss success/info after 5s
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (alert.parentNode) {
          alert.remove();
        }
      }, 5000);
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new ConfigApp();
  app.init().catch(console.error);
});

export {};
