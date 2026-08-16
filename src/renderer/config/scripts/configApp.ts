/**
 * Configuration window application controller.
 * Renders the form from schema and handles user interactions.
 */

/// <reference path="./global.d.ts" />

/* eslint-disable @typescript-eslint/no-explicit-any */

type Language = 'en' | 'pt';

interface Translations {
  appTitle: string;
  appSubtitle: string;
  sectionBasic: string;
  sectionOverlay: string;
  sectionSound: string;
  sectionPerformance: string;
  sectionAdvanced: string;
  quickSetup: string;
  selectPreset: string;
  presetDefault: string;
  presetDefaultDesc: string;
  presetFastPaced: string;
  presetFastPacedDesc: string;
  presetCozy: string;
  presetCozyDesc: string;
  btnTest: string;
  btnReset: string;
  btnCancel: string;
  btnStart: string;
  btnStarting: string;
  btnEnable: string;
  msgWelcome: string;
  msgPresetApplied: string;
  msgResetDefaults: string;
  msgResetConfirm: string;
  msgDiscardChanges: string;
  msgConnectionSuccess: string;
  msgConnectionFailed: string;
  msgEnterUrlFirst: string;
  msgTestingConnection: string;
  msgFixErrors: string;
  msgApiNotAvailable: string;
  msgLoadFailed: string;
  msgStartFailed: string;
  badgeEnvTooltip: string;
  badgeCliTooltip: string;
  [key: string]: string;
}

const TRANSLATIONS: Record<Language, Translations> = {
  en: {
    appTitle: 'Keeping an Eye on the Chat',
    appSubtitle: 'Configure your chat overlay',
    sectionBasic: 'Basic Settings',
    sectionOverlay: 'Overlay Settings',
    sectionSound: 'Sound',
    sectionPerformance: 'Performance',
    sectionAdvanced: 'Advanced Settings',
    quickSetup: 'Quick Setup:',
    selectPreset: '-- Select Preset --',
    presetDefault: 'Default',
    presetDefaultDesc: 'Balanced settings for most streams',
    presetFastPaced: 'Fast-Paced Chat',
    presetFastPacedDesc: 'For high-activity chat with faster message cycling',
    presetCozy: 'Cozy Stream',
    presetCozyDesc: 'Longer display time for slower, relaxed streams',
    btnTest: 'Test',
    btnTestSound: 'Test',
    btnReset: 'Reset to Defaults',
    btnCancel: 'Cancel',
    btnStart: 'Start Overlay',
    btnStarting: 'Starting...',
    btnEnable: 'Enable',
    msgWelcome: 'Welcome! Enter your Twitch chat URL to get started.',
    msgPresetApplied: 'Preset applied. Click Start to begin.',
    msgResetDefaults: 'Settings reset to defaults.',
    msgResetConfirm: 'Reset all settings to defaults? This cannot be undone.',
    msgDiscardChanges: 'Discard unsaved changes?',
    msgConnectionSuccess: 'Connection successful!',
    msgConnectionFailed: 'Connection failed:',
    msgEnterUrlFirst: 'Enter a Twitch Chat URL first',
    msgTestingConnection: 'Testing connection...',
    msgFixErrors: 'Please fix the errors above',
    msgApiNotAvailable: 'Configuration API not available. Please restart the app.',
    msgLoadFailed: 'Failed to load configuration:',
    msgStartFailed: 'Failed to start overlay',
    badgeEnvTooltip: 'This value is set by environment variable',
    badgeCliTooltip: 'This value is set by command line',
    fieldTwitchChatUrl: 'Twitch Chat URL',
    fieldTwitchChatUrlDesc: 'The popout chat URL from your Twitch channel (e.g., https://www.twitch.tv/popout/yourname/chat?popout=)',
    fieldDisplaySeconds: 'Display Duration',
    fieldDisplaySecondsDesc: 'How long each message is shown on screen (in seconds)',
    fieldOverlayAnchor: 'Overlay Position',
    fieldOverlayAnchorDesc: 'Where the chat bubble appears on screen',
    fieldOverlayMargin: 'Screen Margin',
    fieldOverlayMarginDesc: 'Distance from screen edge (in pixels)',
    fieldBubbleMaxWidth: 'Bubble Max Width',
    fieldBubbleMaxWidthDesc: 'Maximum width of the chat bubble (in pixels)',
    fieldMaxMessageLength: 'Max Message Length',
    fieldMaxMessageLengthDesc: 'Messages longer than this will be truncated with an ellipsis',
    fieldIgnoreCommandPrefix: 'Ignore Command Prefix',
    fieldIgnoreCommandPrefixDesc: 'Messages starting with this prefix are ignored (leave empty to disable)',
    fieldIgnoreUsers: 'Ignored Users',
    fieldIgnoreUsersDesc: 'Comma-separated list of usernames to ignore (e.g., "nightbot, streamelements")',
    fieldMaxQueueLength: 'Max Queue Length',
    fieldMaxQueueLengthDesc: 'Maximum number of messages waiting to be displayed. Oldest are dropped when full.',
    fieldExitAnimationMs: 'Exit Animation Duration',
    fieldExitAnimationMsDesc: 'Duration of the exit animation (in milliseconds). Set to 0 to disable.',
    fieldAttentionPauseMs: 'Attention Pause',
    fieldAttentionPauseMsDesc: 'Pause before avatar starts speaking, creating an "I arrived" effect (0 to disable)',
    fieldDiagnostics: 'Enable Diagnostics',
    fieldDiagnosticsDesc: 'Log detailed diagnostic information to the console',
    fieldOverlayDebug: 'Overlay Debug Mode',
    fieldOverlayDebugDesc: 'Show a visible frame around the overlay for positioning',
    fieldDevtools: 'Open DevTools',
    fieldDevtoolsDesc: 'Open developer tools on startup (for debugging)',
    fieldNotificationSoundEnabled: 'Enable Notification Sound',
    fieldNotificationSoundEnabledDesc: 'Play a sound when a new message appears',
    fieldNotificationSoundFile: 'Notification Sound',
    fieldNotificationSoundFileDesc: 'Select an audio file to play when a message appears',
    btnSelectAudio: 'Browse...',
    noFileSelected: '(Default: ./assets/sounds/notification.wav)',
    fieldNotificationSoundVolume: 'Sound Volume',
    fieldNotificationSoundVolumeDesc: 'Volume level for the notification sound (0-100%)',
    fieldNotificationSoundDevice: 'Audio Output Device',
    fieldNotificationSoundDeviceDesc: 'Select which audio device to play the notification sound',
    audioDeviceDefault: 'System Default',
    audioDeviceLoading: 'Loading devices...',
    audioDeviceError: 'Could not load audio devices',
    anchorBottomLeft: 'Bottom Left',
    anchorBottomRight: 'Bottom Right',
    anchorTopLeft: 'Top Left',
    anchorTopRight: 'Top Right',
    fieldDisplayId: 'Display',
    fieldDisplayIdDesc: 'Which monitor to show the overlay on',
    displayPrimary: 'Primary',
  },
  pt: {
    appTitle: 'De Olho no Chat',
    appSubtitle: 'Configure seu overlay de chat',
    sectionBasic: 'Configurações Básicas',
    sectionOverlay: 'Configurações do Overlay',
    sectionSound: 'Som',
    sectionPerformance: 'Performance',
    sectionAdvanced: 'Configurações Avançadas',
    quickSetup: 'Configuração Rápida:',
    selectPreset: '-- Selecionar Preset --',
    presetDefault: 'Padrão',
    presetDefaultDesc: 'Configurações balanceadas para a maioria das streams',
    presetFastPaced: 'Chat Agitado',
    presetFastPacedDesc: 'Para chat de alta atividade com troca mais rápida de mensagens',
    presetCozy: 'Stream Tranquila',
    presetCozyDesc: 'Tempo de exibição mais longo para streams mais relaxadas',
    btnTest: 'Testar',
    btnTestSound: 'Testar',
    btnReset: 'Restaurar Padrões',
    btnCancel: 'Cancelar',
    btnStart: 'Iniciar Overlay',
    btnStarting: 'Iniciando...',
    btnEnable: 'Ativar',
    msgWelcome: 'Bem-vindo! Digite a URL do chat da Twitch para começar.',
    msgPresetApplied: 'Preset aplicado. Clique em Iniciar para começar.',
    msgResetDefaults: 'Configurações restauradas para os padrões.',
    msgResetConfirm: 'Restaurar todas as configurações para os padrões? Isso não pode ser desfeito.',
    msgDiscardChanges: 'Descartar alterações não salvas?',
    msgConnectionSuccess: 'Conexão bem-sucedida!',
    msgConnectionFailed: 'Falha na conexão:',
    msgEnterUrlFirst: 'Digite uma URL de Chat da Twitch primeiro',
    msgTestingConnection: 'Testando conexão...',
    msgFixErrors: 'Por favor, corrija os erros acima',
    msgApiNotAvailable: 'API de configuração não disponível. Por favor, reinicie o aplicativo.',
    msgLoadFailed: 'Falha ao carregar configuração:',
    msgStartFailed: 'Falha ao iniciar overlay',
    badgeEnvTooltip: 'Este valor é definido por variável de ambiente',
    badgeCliTooltip: 'Este valor é definido por linha de comando',
    fieldTwitchChatUrl: 'URL do Chat da Twitch',
    fieldTwitchChatUrlDesc: 'A URL do chat popout do seu canal Twitch (ex: https://www.twitch.tv/popout/seunome/chat?popout=)',
    fieldDisplaySeconds: 'Duração de Exibição',
    fieldDisplaySecondsDesc: 'Por quanto tempo cada mensagem é mostrada na tela (em segundos)',
    fieldOverlayAnchor: 'Posição do Overlay',
    fieldOverlayAnchorDesc: 'Onde o balão de chat aparece na tela',
    fieldOverlayMargin: 'Margem da Tela',
    fieldOverlayMarginDesc: 'Distância da borda da tela (em pixels)',
    fieldBubbleMaxWidth: 'Largura Máx. do Balão',
    fieldBubbleMaxWidthDesc: 'Largura máxima do balão de chat (em pixels)',
    fieldMaxMessageLength: 'Tamanho Máx. da Mensagem',
    fieldMaxMessageLengthDesc: 'Mensagens maiores que isso serão truncadas com reticências',
    fieldIgnoreCommandPrefix: 'Prefixo de Comando a Ignorar',
    fieldIgnoreCommandPrefixDesc: 'Mensagens começando com este prefixo são ignoradas (deixe vazio para desativar)',
    fieldIgnoreUsers: 'Usuários Ignorados',
    fieldIgnoreUsersDesc: 'Lista de usuários a ignorar separados por vírgula (ex: "nightbot, streamelements")',
    fieldMaxQueueLength: 'Tamanho Máx. da Fila',
    fieldMaxQueueLengthDesc: 'Número máximo de mensagens aguardando para serem exibidas. As mais antigas são descartadas quando cheia.',
    fieldExitAnimationMs: 'Duração da Animação de Saída',
    fieldExitAnimationMsDesc: 'Duração da animação de saída (em milissegundos). Defina como 0 para desativar.',
    fieldAttentionPauseMs: 'Pausa de Atenção',
    fieldAttentionPauseMsDesc: 'Pausa antes do avatar começar a falar, criando um efeito de "cheguei" (0 para desativar)',
    fieldDiagnostics: 'Ativar Diagnósticos',
    fieldDiagnosticsDesc: 'Registrar informações detalhadas de diagnóstico no console',
    fieldOverlayDebug: 'Modo Debug do Overlay',
    fieldOverlayDebugDesc: 'Mostrar uma moldura visível ao redor do overlay para posicionamento',
    fieldDevtools: 'Abrir DevTools',
    fieldDevtoolsDesc: 'Abrir ferramentas de desenvolvedor ao iniciar (para depuração)',
    fieldNotificationSoundEnabled: 'Ativar Som de Notificação',
    fieldNotificationSoundEnabledDesc: 'Tocar um som quando uma nova mensagem aparecer',
    fieldNotificationSoundFile: 'Som de Notificação',
    fieldNotificationSoundFileDesc: 'Selecione um arquivo de áudio para tocar quando uma mensagem aparecer',
    btnSelectAudio: 'Procurar...',
    noFileSelected: '(Padrão: ./assets/sounds/notification.wav)',
    fieldNotificationSoundVolume: 'Volume do Som',
    fieldNotificationSoundVolumeDesc: 'Nível de volume do som de notificação (0-100%)',
    fieldNotificationSoundDevice: 'Dispositivo de Saída de Áudio',
    fieldNotificationSoundDeviceDesc: 'Selecione qual dispositivo de áudio tocará o som de notificação',
    audioDeviceDefault: 'Padrão do Sistema',
    audioDeviceLoading: 'Carregando dispositivos...',
    audioDeviceError: 'Não foi possível carregar os dispositivos de áudio',
    anchorBottomLeft: 'Inferior Esquerdo',
    anchorBottomRight: 'Inferior Direito',
    anchorTopLeft: 'Superior Esquerdo',
    anchorTopRight: 'Superior Direito',
    fieldDisplayId: 'Tela',
    fieldDisplayIdDesc: 'Em qual monitor exibir o overlay',
    displayPrimary: 'Principal',
  },
};

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
  private schema: Record<string, any> = {};
  private sections: readonly string[] = [];
  private sectionMeta: Record<string, { title: string; description: string }> = {};
  private presets: any[] = [];
  private config: Record<string, any> = {};
  private sources: Record<string, string> = {};
  private originalConfig: Record<string, any> = {};
  private errors: Record<string, string> = {};
  private isDirty = false;
  private isFirstRun = false;
  private currentLang: Language = getInitialLanguage();
  private t: Translations = TRANSLATIONS[this.currentLang];

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
        this.currentLang = this.config.language as Language;
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
    this.validateAndUpdate();
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

      const fields = Object.values(this.schema).filter(
        (field: any) => field.section === section && field.key !== 'language'
      ) as any[];

      for (const field of fields) {
        container.appendChild(this.createField(field));
      }
    }
  }

  /**
   * Get translated field label.
   */
  private getFieldLabel(key: string): string {
    const labelKey = `field${this.capitalize(key)}` as keyof Translations;
    return this.t[labelKey] || key;
  }

  /**
   * Get translated field description.
   */
  private getFieldDesc(key: string): string {
    const descKey = `field${this.capitalize(key)}Desc` as keyof Translations;
    return this.t[descKey] || '';
  }

  /**
   * Capitalize first letter.
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Fields that depend on notificationSoundEnabled being true.
   */
  private readonly soundDependentFields = [
    'notificationSoundDevice',
    'notificationSoundFile',
    'notificationSoundVolume',
  ];

  /**
   * Create a form field element.
   */
  private createField(meta: any): HTMLElement {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-field';
    fieldDiv.dataset.key = meta.key;

    const source = this.sources[meta.key];
    const isOverridden = source === 'env' || source === 'cli';

    // Check if this field should be disabled because sound is disabled
    const isSoundDependent = this.soundDependentFields.includes(meta.key);
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
  private getAnchorLabel(value: string): string {
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
  private createInput(meta: any, disabled: boolean): HTMLElement {
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

      // Load displays dynamically
      this.loadDisplays(select, value);

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
        option.value = opt.value;
        // Translate anchor options
        if (meta.key === 'overlayAnchor') {
          option.textContent = this.getAnchorLabel(opt.value);
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

      // Load audio devices asynchronously
      this.loadAudioDevices(select, value);

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
      valueDisplay.textContent = `${value ?? 50}%`;

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

    // Add Test Connection button for twitchChatUrl
    if (meta.key === 'twitchChatUrl') {
      const testBtn = document.createElement('button');
      testBtn.type = 'button';
      testBtn.className = 'btn btn--secondary btn--small';
      testBtn.textContent = this.t.btnTest;
      testBtn.id = 'testConnectionBtn';
      testBtn.disabled = disabled;
      container.appendChild(testBtn);
    }

    return container;
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
      // Test connection button (delegated event)
      if (target.id === 'testConnectionBtn' || target.closest('#testConnectionBtn')) {
        this.testConnection();
      }
      // Test sound button (delegated event)
      if (target.id === 'testSoundBtn' || target.closest('#testSoundBtn')) {
        this.testSound();
      }
      // Select audio file button (delegated event)
      if (target.id === 'selectAudioBtn' || target.closest('#selectAudioBtn')) {
        this.selectAudioFile();
      }
    });

    // Preset selection
    document.getElementById('presetSelect')?.addEventListener('change', async (e) => {
      const select = e.target as HTMLSelectElement;
      if (select.value) {
        await this.applyPreset(select.value);
        select.value = '';
      }
    });

    // Logo click - open GitHub profile in default browser
    document.getElementById('headerLogo')?.addEventListener('click', () => {
      window.configAPI.openExternal('https://github.com/didevlab');
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
    document.getElementById('resetBtn')?.addEventListener('click', async () => {
      await this.resetToDefaults();
    });

    // Cancel button
    document.getElementById('cancelBtn')?.addEventListener('click', () => {
      this.handleCancel();
    });

    // Start button
    document.getElementById('startBtn')?.addEventListener('click', () => {
      this.startOverlay();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl+Enter to start
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
        if (!startBtn.disabled) {
          this.startOverlay();
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

    const key = id.replace('input-', '');
    const meta = this.schema[key];
    if (!meta) return;

    let value: any;
    if (target.type === 'checkbox') {
      value = (target as HTMLInputElement).checked;
    } else {
      // Form controls always yield strings; the schema decides the real type.
      value = window.configValues.coerceFieldValue(meta, target.value);
    }

    this.config[key] = value;
    this.isDirty = true;

    // Update dependent fields when sound enabled checkbox changes
    if (key === 'notificationSoundEnabled') {
      this.updateSoundDependentFields(Boolean(value));
    }

    this.validateAndUpdate();
  }

  /**
   * Update the enabled/disabled state of sound-dependent fields.
   */
  private updateSoundDependentFields(soundEnabled: boolean): void {
    for (const fieldKey of this.soundDependentFields) {
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
    for (const key of Object.keys(this.schema)) {
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
   * Test connection to Twitch URL.
   */
  private async testConnection(): Promise<void> {
    const url = this.config.twitchChatUrl;
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
    } catch (err) {
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
    } catch (err) {
      this.showAlert('error', this.t.msgStartFailed);
      restoreStartButton();
    }
  }

  /**
   * Focus the first required field that's empty.
   */
  private focusFirstRequiredField(): void {
    for (const [key, meta] of Object.entries(this.schema) as [string, any][]) {
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
   * Load available displays and populate the select element.
   */
  private async loadDisplays(select: HTMLSelectElement, currentValue: unknown): Promise<void> {
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
  private async loadAudioDevices(select: HTMLSelectElement, currentValue: string): Promise<void> {
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
