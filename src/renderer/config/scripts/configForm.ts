/**
 * Form rendering for the configuration wizard.
 *
 * Everything that turns schema metadata into DOM lives here. It is a separate
 * <script> tag because the wizard has no module bundler; the controller in
 * configApp.ts owns state, IPC and events, and hands this a context to read
 * from.
 */

import type {
  AppConfig,
  ConfigSource,
  SerializableFieldMeta,
} from '../../../config/types';

/** A configuration field name. */
type ConfigKey = keyof AppConfig;

/** A language table, keyed by translation id. */
type Translations = Record<string, string>;

/**
 * What the renderer needs from the controller.
 *
 * Passed rather than imported: the renderer reads the configuration the user is
 * editing, and only the controller knows that state.
 */
export interface FormRenderContext {
  /** The active language table. */
  t: Translations;
  /** The configuration currently being edited. */
  config: AppConfig;
  /** Where each value came from, so overridden fields can be locked. */
  sources: Partial<Record<ConfigKey, ConfigSource>>;
  /** Write a coerced value back into the configuration. */
  setConfigValue: (key: ConfigKey, value: unknown) => void;
  /** Diagnostic logging. */
  log: (message: string) => void;
}

/**
 * Settings that only apply when the notification sound is enabled.
 *
 * Exported because the controller disables them live when the checkbox flips,
 * and both sides must agree on the list.
 */
export const SOUND_DEPENDENT_FIELDS: ConfigKey[] = [
  'notificationSoundDevice',
  'notificationSoundFile',
  'notificationSoundVolume',
];

/**
 * Fields holding a chat URL, each of which gets its own Test button.
 *
 * Exported so the controller can resolve a clicked button back to its field
 * without parsing the id by hand.
 */
export const CHAT_URL_FIELDS: ConfigKey[] = ['twitchChatUrl', 'kickChatUrl'];

/** The id of the Test button belonging to a chat URL field. */
export function testButtonId(key: ConfigKey): string {
  return `test-${key}`;
}

/** The chat URL field a Test button belongs to, or null. */
export function chatUrlFieldOfButton(element: HTMLElement | null): ConfigKey | null {
  const button = element ? element.closest('[data-field]') : null;
  const field = button instanceof HTMLElement ? button.dataset.field : undefined;
  return field && CHAT_URL_FIELDS.includes(field as ConfigKey) ? (field as ConfigKey) : null;
}

export class ConfigFormRenderer {
  private readonly ctx: FormRenderContext;

  constructor(context: FormRenderContext) {
    this.ctx = context;
  }

  /** Shorthand for the active language table. */
  private get t(): Translations {
    return this.ctx.t;
  }

  /** Shorthand for the configuration being edited. */
  private get config(): AppConfig {
    return this.ctx.config;
  }

  /** Shorthand for the value sources. */
  private get sources(): Partial<Record<ConfigKey, ConfigSource>> {
    return this.ctx.sources;
  }

  /** Diagnostic logging, routed back to the controller. */
  private log(message: string): void {
    this.ctx.log(message);
  }

  /**
   * Get translated field label.
   */
  getFieldLabel(key: string): string {
    return this.t[`field${this.capitalize(key)}`] || key;
  }

  /**
   * Get translated field description.
   */
  getFieldDesc(key: string): string {
    return this.t[`field${this.capitalize(key)}Desc`] || '';
  }

  /**
   * Capitalize first letter.
   */
  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Create a form field element.
   */
  /** Build one labelled, described, validated form field. */
  createField(meta: SerializableFieldMeta): HTMLElement {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-field';
    fieldDiv.dataset.key = meta.key;

    const source = this.sources[meta.key];
    const isOverridden = source === 'env' || source === 'cli';

    // Check if this field should be disabled because sound is disabled
    const isSoundDependent = SOUND_DEPENDENT_FIELDS.includes(meta.key);
    const soundEnabled = Boolean(this.config.notificationSoundEnabled);
    const shouldDisable = isOverridden || (isSoundDependent && !soundEnabled);

    // Label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'form-label';

    const labelText = document.createElement('span');
    labelText.textContent = this.getFieldLabel(meta.key);
    if (meta.required) {
      const req = document.createElement('span');
      req.className = 'required';
      req.textContent = ' *';
      labelText.appendChild(req);
    }
    labelDiv.appendChild(labelText);

    // Override badge
    if (isOverridden) {
      const badge = document.createElement('span');
      badge.className = `override-badge override-badge--${source}`;
      badge.textContent = source.toUpperCase();
      badge.title = source === 'env' ? this.t.badgeEnvTooltip : this.t.badgeCliTooltip;
      labelDiv.appendChild(badge);
    }

    fieldDiv.appendChild(labelDiv);

    // Description
    const description = this.getFieldDesc(meta.key);
    if (description) {
      const desc = document.createElement('p');
      desc.className = 'form-description';
      desc.textContent = description;
      fieldDiv.appendChild(desc);
    }

    // Input element
    const inputContainer = this.createInput(meta, shouldDisable);
    fieldDiv.appendChild(inputContainer);

    // Error container
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.id = `error-${meta.key}`;
    fieldDiv.appendChild(errorDiv);

    return fieldDiv;
  }

  /**
   * Get translated anchor option label.
   */
  getAnchorLabel(value: string): string {
    const map: Record<string, keyof Translations> = {
      'bottom-left': 'anchorBottomLeft',
      'bottom-right': 'anchorBottomRight',
      'top-left': 'anchorTopLeft',
      'top-right': 'anchorTopRight',
    };
    const key = map[value];
    return key ? this.t[key] : value;
  }

  /**
   * Create the appropriate input element for a field.
   */
  createInput(meta: SerializableFieldMeta, disabled: boolean): HTMLElement {
    const value = this.config[meta.key];

    // Boolean checkbox
    if (meta.type === 'boolean') {
      const label = document.createElement('label');
      label.className = 'form-checkbox';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `input-${meta.key}`;
      input.checked = Boolean(value);
      input.disabled = disabled;

      label.appendChild(input);
      label.appendChild(document.createTextNode(` ${this.t.btnEnable}`));
      return label;
    }

    // Display selector (dynamic options from system) - must come BEFORE generic select
    if (meta.key === 'displayId') {
      const select = document.createElement('select');
      select.className = 'form-select';
      select.id = `input-${meta.key}`;
      select.disabled = disabled;

      // Load displays dynamically (fire and forget: the <select> fills in later)
      void this.loadDisplays(select, value);

      // Show visual indicator when user changes selection
      select.addEventListener('change', () => {
        const selectedId = Number(select.value);
        if (selectedId > 0) {
          window.configAPI.showDisplayIndicator(selectedId).catch(console.error);
        }
      });

      return select;
    }

    // Select dropdown (generic)
    if (meta.type === 'select') {
      const select = document.createElement('select');
      select.className = 'form-select';
      select.id = `input-${meta.key}`;
      select.disabled = disabled;

      for (const opt of meta.options || []) {
        const option = document.createElement('option');
        // A DOM option value is always a string; the schema type is what
        // decides how it is read back (see configValues.coerceFieldValue).
        option.value = String(opt.value);
        // Translate anchor options
        if (meta.key === 'overlayAnchor') {
          option.textContent = this.getAnchorLabel(String(opt.value));
        } else {
          option.textContent = opt.label;
        }
        option.selected = value === opt.value;
        select.appendChild(option);
      }

      return select;
    }

    // Audio device selector (dynamic options from system)
    if (meta.key === 'notificationSoundDevice') {
      const select = document.createElement('select');
      select.className = 'form-select';
      select.id = `input-${meta.key}`;
      select.disabled = disabled;

      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = this.t.audioDeviceDefault;
      defaultOption.selected = !value;
      select.appendChild(defaultOption);

      // Load audio devices asynchronously (the <select> fills in later)
      void void this.loadAudioDevices(select, value as string);

      return select;
    }

    // Volume slider
    if (meta.key === 'notificationSoundVolume') {
      const container = document.createElement('div');
      container.className = 'form-range-container';

      const range = document.createElement('input');
      range.type = 'range';
      range.className = 'form-range';
      range.id = `input-${meta.key}`;
      range.min = String(meta.min ?? 0);
      range.max = String(meta.max ?? 100);
      range.value = String(value ?? 50);
      range.disabled = disabled;

      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'form-range-value';
      valueDisplay.id = `value-${meta.key}`;
      valueDisplay.textContent = `${typeof value === 'number' ? value : 50}%`;

      // Update display when slider changes
      range.addEventListener('input', () => {
        valueDisplay.textContent = `${range.value}%`;
      });

      // Test sound button
      const testBtn = document.createElement('button');
      testBtn.type = 'button';
      testBtn.className = 'btn btn--secondary btn--small';
      testBtn.textContent = this.t.btnTestSound;
      testBtn.id = 'testSoundBtn';
      testBtn.disabled = disabled;

      container.appendChild(range);
      container.appendChild(valueDisplay);
      container.appendChild(testBtn);

      return container;
    }

    // Audio file picker with browse button
    if (meta.key === 'notificationSoundFile') {
      const container = document.createElement('div');
      container.className = 'form-file-picker';

      const pathDisplay = document.createElement('input');
      pathDisplay.type = 'text';
      pathDisplay.className = 'form-input form-input--file-path';
      pathDisplay.id = `input-${meta.key}`;
      pathDisplay.value = String(value ?? '');
      pathDisplay.readOnly = true;
      pathDisplay.disabled = disabled;
      pathDisplay.placeholder = this.t.noFileSelected;

      const browseBtn = document.createElement('button');
      browseBtn.type = 'button';
      browseBtn.className = 'btn btn--secondary btn--small';
      browseBtn.textContent = this.t.btnSelectAudio;
      browseBtn.id = 'selectAudioBtn';
      browseBtn.disabled = disabled;

      container.appendChild(pathDisplay);
      container.appendChild(browseBtn);

      return container;
    }

    // Text/number input (possibly with test button)
    const container = document.createElement('div');
    container.className = 'form-input-group';

    const input = document.createElement('input');
    input.className = 'form-input';
    input.id = `input-${meta.key}`;
    input.type = meta.type === 'number' ? 'number' : 'text';
    input.value = Array.isArray(value) ? value.join(', ') : String(value ?? '');
    input.disabled = disabled;

    if (meta.placeholder) {
      input.placeholder = meta.placeholder;
    }
    if (meta.min !== undefined) {
      input.min = String(meta.min);
    }
    if (meta.max !== undefined) {
      input.max = String(meta.max);
    }

    container.appendChild(input);

    // Every platform URL gets its own Test button, keyed by field: with more
    // than one URL a shared id would collide and the wrong URL would be tested.
    if (CHAT_URL_FIELDS.includes(meta.key)) {
      const testBtn = document.createElement('button');
      testBtn.type = 'button';
      testBtn.className = 'btn btn--secondary btn--small';
      testBtn.textContent = this.t.btnTest;
      testBtn.id = testButtonId(meta.key);
      testBtn.dataset.field = meta.key;
      testBtn.disabled = disabled;
      container.appendChild(testBtn);
    }

    return container;
  }

  /**
   * Load available displays and populate the select element.
   */
  async loadDisplays(select: HTMLSelectElement, currentValue: unknown): Promise<void> {
    try {
      const displays = await window.configAPI.getDisplays();

      // Configs written before displayId was coerced hold a numeric string.
      const savedId = Number(currentValue);
      const selectedId = Number.isFinite(savedId) ? savedId : 0;
      const isKnown = displays.some((display) => display.id === selectedId);

      for (const display of displays) {
        const option = document.createElement('option');
        option.value = String(display.id);
        // Translate "Primary" label
        if (display.isPrimary) {
          option.textContent = `${display.bounds.width}x${display.bounds.height} (${this.t.displayPrimary})`;
        } else {
          option.textContent = display.label;
        }
        option.selected = isKnown ? display.id === selectedId : display.isPrimary;
        select.appendChild(option);
      }

      // Keep the config in step with what the dropdown actually shows, so a
      // disconnected monitor is not persisted back to disk.
      const resolved = Number(select.value);
      if (Number.isFinite(resolved)) {
        this.config.displayId = resolved;
      }

      this.log(`Found ${displays.length} display(s)`);
    } catch (err) {
      console.error('Failed to enumerate displays:', err);
      // Add a fallback "Primary" option
      const option = document.createElement('option');
      option.value = '0';
      option.textContent = this.t.displayPrimary;
      option.selected = true;
      select.appendChild(option);
    }
  }

  /**
   * Load available audio output devices and populate the select element.
   */
  async loadAudioDevices(select: HTMLSelectElement, currentValue: string): Promise<void> {
    try {
      // Request permission to enumerate devices (may require user gesture)
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

        for (const device of audioOutputs) {
          // Skip the default device as we already have a "System Default" option
          if (device.deviceId === 'default') continue;

          const option = document.createElement('option');
          option.value = device.deviceId;
          // Use label if available, otherwise show truncated device ID
          option.textContent = device.label || `Audio Device (${device.deviceId.slice(0, 8)}...)`;
          option.selected = device.deviceId === currentValue;
          select.appendChild(option);
        }

        if (audioOutputs.length === 0) {
          this.log('No audio output devices found');
        } else {
          this.log(`Found ${audioOutputs.length} audio output devices`);
        }
      } else {
        this.log('mediaDevices.enumerateDevices not available');
      }
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err);
      const errorOption = document.createElement('option');
      errorOption.value = '';
      errorOption.textContent = this.t.audioDeviceError;
      errorOption.disabled = true;
      select.appendChild(errorOption);
    }
  }
}

// Published for the wizard's <script> tag loader; guarded so the module can also
// be required from a plain Node test runner.
if (typeof window !== 'undefined') {
  window.configForm = {
    ConfigFormRenderer,
    SOUND_DEPENDENT_FIELDS,
    CHAT_URL_FIELDS,
    testButtonId,
    chatUrlFieldOfButton,
  };
}
