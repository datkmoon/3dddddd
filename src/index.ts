import * as THREE from 'three';
import * as xb from 'xrblocks';
import { ModelLoaderService, ModelMetadata } from './modelLoader.ts';
import {
  createSciFiMech,
  createModernLoungeChair,
  createPlanetEarth,
  createTorusSculpture,
} from './proceduralModels.ts';
import { Language, translations } from './i18n.ts';

const ASSETS_BASE_URL = 'https://cdn.jsdelivr.net/gh/xrblocks/assets@main/';

/**
 * Main WebAR Scene Script
 */
class WebARScene extends xb.Script {
  private modelLoader = new ModelLoaderService();
  private modelViewer!: xb.ModelViewer;
  private currentObject: THREE.Object3D | null = null;
  private activeMetadata: ModelMetadata | null = null;

  // Floor plane for mobile tap-to-place and desktop interaction
  private floorPlane!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  // State
  private lang: Language = 'ar';
  private autoRotate = false;
  private currentScale = 1.0;
  private initialObjectDistance = 1.2;
  private isPlacing = false;
  private deferredInstallPrompt: any = null;

  // In-world Spatial UI Card
  private spatialCard?: xb.UICard;
  private spatialStatusText?: xb.UIText;
  private spatialScaleText?: xb.UIText;

  // DOM Elements
  private appRoot!: HTMLElement;
  private fileInput!: HTMLInputElement;

  init() {
    this.setupLighting();
    this.setupFloorPlane();
    this.setupModelViewer();
    this.setupSpatialUI();
    this.setupDomOverlay();
    this.setupDragAndDrop();
    this.setupTouchGestures();
    this.setupPwaInstall();

    // Load initial default model
    this.loadPreset('mech');
  }

  private setupLighting() {
    // Studio PBR lighting: warm directional key light + cool hemisphere fill
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 2.8);
    this.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 2.5);
    dirLight.position.set(2, 6, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.bias = -0.0001;
    this.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    fillLight.position.set(-3, 2, -2);
    this.add(fillLight);
  }

  private setupFloorPlane() {
    // Invisible plane at floor level (y = 0) for raycasting & placement
    const geo = new THREE.PlaneGeometry(100, 100);
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    this.floorPlane = new THREE.Mesh(geo, mat);
    this.floorPlane.rotation.x = -Math.PI / 2;
    this.floorPlane.position.y = 0;
    this.floorPlane.name = 'VirtualFloorPlane';
    this.add(this.floorPlane);
  }

  private setupModelViewer() {
    this.modelViewer = new xb.ModelViewer({
      origin: 'bottom-center',
      manipulation: {
        actions: {
          rotate: { axis: 'y' },
          scale: { minScale: 0.05, maxScale: 8.0 },
        },
        handle: { action: xb.ManipulationAction.Rotate },
      },
    });

    // Position in front of camera
    this.modelViewer.position.set(0, 0, -this.initialObjectDistance);
    this.add(this.modelViewer);
  }

  /**
   * Builds the 3D in-headset Spatial UI Card using XR Blocks UI components
   */
  private setupSpatialUI() {
    const t = translations[this.lang];

    this.spatialStatusText = new xb.UIText({
      text: t.modelReady,
      style: { fontSize: 16, textAlign: 'center', opacity: 0.8 },
    });

    this.spatialScaleText = new xb.UIText({
      text: '100%',
      style: { fontSize: 20, fontWeight: 'bold' },
    });

    const scaleSlider = new xb.UISlider({
      ariaLabel: 'Model scale',
      min: 10,
      max: 300,
      step: 5,
      value: 100,
      style: { width: '100%', height: 38 },
      onInput: (val: number) => {
        this.setScale(val / 100);
      },
    });

    const header = new xb.UIPanel({
      style: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      },
      children: [
        new xb.UIIcon({
          icon: 'view_in_ar',
          style: { width: 36, height: 36, color: '#3b82f6' },
        }),
        new xb.UIPanel({
          style: { flexDirection: 'column', gap: 2 },
          children: [
            new xb.UIText({
              text: 'WebAR 3D Placer',
              style: { fontSize: 22, fontWeight: 'bold' },
            }),
            new xb.UIText({
              text: 'Move • Scale • Rotate',
              style: { fontSize: 13, opacity: 0.7 },
            }),
          ],
        }),
      ],
    });

    const actionButtons = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8 },
      children: [
        new xb.UIButton({
          label: '↺ -45°',
          icon: 'rotate_left',
          style: { flexGrow: 1 },
          onClick: () => this.rotateModel(-Math.PI / 4),
        }),
        new xb.UIButton({
          label: '↻ +45°',
          icon: 'rotate_right',
          style: { flexGrow: 1 },
          onClick: () => this.rotateModel(Math.PI / 4),
        }),
        new xb.UIButton({
          label: 'Reset',
          icon: 'restart_alt',
          style: { flexGrow: 1 },
          onClick: () => this.resetModelTransform(),
        }),
      ],
    });

    const moveButtons = new xb.UIPanel({
      style: { width: '100%', flexDirection: 'row', gap: 8 },
      children: [
        new xb.UIButton({
          label: 'Closer',
          icon: 'arrow_downward',
          style: { flexGrow: 1 },
          onClick: () => this.moveModel(0, 0, 0.2),
        }),
        new xb.UIButton({
          label: 'Farther',
          icon: 'arrow_upward',
          style: { flexGrow: 1 },
          onClick: () => this.moveModel(0, 0, -0.2),
        }),
        new xb.UIButton({
          label: 'Floor',
          icon: 'vertical_align_bottom',
          style: { flexGrow: 1 },
          onClick: () => this.snapToFloor(),
        }),
      ],
    });

    this.spatialCard = new xb.UICard({
      size: { width: 0.52, height: 'auto' },
      manipulation: true,
      edge: true,
      style: {
        flexDirection: 'column',
        gap: 14,
        padding: 18,
        borderRadius: 20,
      },
      children: [
        new xb.UIExitButton(),
        header,
        this.spatialStatusText,
        new xb.UIPanel({
          style: {
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          children: [
            new xb.UIText({
              text: 'Model Scale',
              style: { fontSize: 16, fontWeight: 'bold' },
            }),
            this.spatialScaleText,
          ],
        }),
        scaleSlider,
        actionButtons,
        moveButtons,
      ],
    });

    // Position spatial card slightly to the right of the model
    this.spatialCard.position.set(0.68, 1.45, -1.25);
    this.spatialCard.rotation.y = -0.25;
    this.spatialCard.name = 'SpatialControlCard';
    this.add(this.spatialCard);
  }

  /**
   * Builds the 2D HTML floating HUD for mobile phones, tablets, and desktop
   */
  private setupDomOverlay() {
    this.appRoot = document.getElementById('app-root') || document.body;

    // Hidden file input for uploading any GLB/GLTF
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.glb,.gltf';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    document.body.appendChild(this.fileInput);

    this.renderDomHud();
  }

  private renderDomHud() {
    const t = translations[this.lang];
    const isAr = this.lang === 'ar';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = this.lang;

    this.appRoot.innerHTML = `
      <div class="ar-hud-container" dir="${isAr ? 'rtl' : 'ltr'}">
        <!-- Top Bar -->
        <header class="glass-panel ar-top-bar">
          <div class="ar-brand">
            <div class="ar-brand-icon">📦</div>
            <div class="ar-brand-text">
              <h1>${t.appTitle}</h1>
              <p>${t.appSubtitle}</p>
            </div>
          </div>

          <div class="ar-top-actions">
            <!-- Language Switcher -->
            <button id="btn-lang" class="btn-pill" title="Toggle Language">
              🌐 ${t.switchLanguage}
            </button>

            <!-- Install APK button -->
            <button id="btn-apk" class="btn-pill btn-success" title="${t.installApkTitle}">
              📱 ${t.installApk}
            </button>

            <!-- Help modal button -->
            <button id="btn-help" class="btn-pill" title="Help">
              ℹ️
            </button>
          </div>
        </header>

        <!-- Floating Model Badge -->
        <div id="model-badge" class="ar-model-badge">
          <div class="badge-dot"></div>
          <span id="badge-name">${this.activeMetadata ? this.activeMetadata.name : t.loadingModel}</span>
          <span id="badge-stats" style="color: #94a3b8; font-size: 11px;">
            ${this.activeMetadata ? `(${this.activeMetadata.triangleCount.toLocaleString()} ▲ • ${Math.round(this.activeMetadata.dimensions.x * 100 * this.currentScale)}cm)` : ''}
          </span>
        </div>

        <!-- Tap to Place hint -->
        <div class="placement-hint">
          <span>✨</span>
          <span>${t.reticleHint}</span>
        </div>

        <!-- Bottom Controls Dock -->
        <div class="glass-panel ar-dock">
          <!-- Preset selector pills -->
          <div class="model-preset-row">
            <button class="preset-chip active" data-preset="mech">🤖 ${t.presetMech}</button>
            <button class="preset-chip" data-preset="chair">🪑 ${t.presetChair}</button>
            <button class="preset-chip" data-preset="earth">🌍 ${t.presetEarth}</button>
            <button class="preset-chip" data-preset="cat">🐱 ${t.presetCat}</button>
            <button class="preset-chip" data-preset="dino">🦖 ${t.presetDino}</button>
            <button class="preset-chip" data-preset="sculpture">🏺 ${t.presetSculpture}</button>
          </div>

          <!-- Actions toolbar -->
          <div class="dock-actions-row">
            <!-- Upload GLB/GLTF Button -->
            <button id="btn-upload" class="dock-btn dock-btn-upload">
              📂 ${t.uploadModel}
            </button>

            <!-- Scale controls -->
            <div class="tool-group">
              <button id="btn-scale-down" class="dock-btn" title="${t.scaleDown}">➖</button>
              <div class="scale-slider-container">
                <input type="range" id="dock-scale-slider" min="10" max="300" step="5" value="${Math.round(this.currentScale * 100)}" />
                <span id="scale-val-label" style="font-size: 11px; min-width: 32px; text-align: center;">${Math.round(this.currentScale * 100)}%</span>
              </div>
              <button id="btn-scale-up" class="dock-btn" title="${t.scaleUp}">➕</button>
            </div>

            <!-- Rotation controls -->
            <div class="tool-group">
              <button id="btn-rot-left" class="dock-btn" title="${t.rotateLeft}">↺ 45°</button>
              <button id="btn-rot-right" class="dock-btn" title="${t.rotateRight}">↻ 45°</button>
              <button id="btn-rot-auto" class="dock-btn ${this.autoRotate ? 'active-toggle' : ''}" title="${t.rotateAuto}">
                🔄
              </button>
            </div>

            <!-- Position controls -->
            <div class="tool-group">
              <button id="btn-move-closer" class="dock-btn" title="${t.moveCloser}">⬇️ ${t.moveCloser}</button>
              <button id="btn-move-farther" class="dock-btn" title="${t.moveFarther}">⬆️ ${t.moveFarther}</button>
              <button id="btn-snap-floor" class="dock-btn" title="${t.dropToFloor}">⚓ ${t.dropToFloor}</button>
              <button id="btn-reset" class="dock-btn" title="${t.reset}">🔄</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Drag & Drop Overlay -->
      <div id="drop-overlay" class="drop-zone-overlay hidden">
        <div style="font-size: 64px;">📥</div>
        <h2 style="font-size: 24px; font-weight: 700; margin: 0; color: #fff;">${t.dropZoneText}</h2>
        <p style="font-size: 14px; color: #94a3b8; margin: 0;">${t.uploadHint}</p>
      </div>

      <!-- APK Install Modal -->
      <div id="apk-modal" class="modal-backdrop" style="display: none;">
        <div class="modal-content" dir="${isAr ? 'rtl' : 'ltr'}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #3b82f6; display: flex; align-items: center; gap: 8px;">
              <span>📱</span> ${t.installApkTitle}
            </h2>
            <button id="modal-close-apk" class="btn-pill">✕</button>
          </div>
          <p style="font-weight: 600; color: #e2e8f0; margin-bottom: 12px; font-size: 14px;">${t.installGuideHeader}</p>
          <div style="display: flex; flex-direction: column; gap: 10px; color: #cbd5e1; font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
            <p>${t.installStep1}</p>
            <p>${t.installStep2}</p>
            <p>${t.installStep3}</p>
            <p>${t.installStep4}</p>
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="btn-trigger-pwa" class="btn-pill btn-primary" style="padding: 10px 20px; font-size: 14px;">
              📥 ${t.installNow}
            </button>
            <button id="modal-cancel-apk" class="btn-pill">${t.close}</button>
          </div>
        </div>
      </div>

      <!-- Help Modal -->
      <div id="help-modal" class="modal-backdrop" style="display: none;">
        <div class="modal-content" dir="${isAr ? 'rtl' : 'ltr'}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #3b82f6;">ℹ️ ${t.appTitle}</h2>
            <button id="modal-close-help" class="btn-pill">✕</button>
          </div>
          <div style="color: #cbd5e1; font-size: 14px; line-height: 1.6; display: flex; flex-direction: column; gap: 12px;">
            <p><strong>📱 ${t.controlsHelp}</strong></p>
            <p><strong>🕶️ ${t.xrControlsNote}</strong></p>
            <div style="background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 12px; margin-top: 8px;">
              <p style="margin: 0; font-size: 13px;">
                💡 <em>${isAr ? 'يمكنك رفع أي ملف .glb أو .gltf من زر الرفع أو سحبه وإفلاته مباشرة في المتصفح.' : 'You can upload any .glb or .gltf file by clicking Upload or dragging and dropping into the browser.'}</em>
              </p>
            </div>
          </div>
          <div style="margin-top: 20px; text-align: ${isAr ? 'left' : 'right'};">
            <button id="modal-ok-help" class="btn-pill btn-primary">${t.close}</button>
          </div>
        </div>
      </div>
    `;

    this.bindDomEvents();
  }

  private bindDomEvents() {
    // Language toggle
    document.getElementById('btn-lang')?.addEventListener('click', () => {
      this.lang = this.lang === 'ar' ? 'en' : 'ar';
      this.renderDomHud();
      this.updateBadge();
    });

    // Upload button
    document.getElementById('btn-upload')?.addEventListener('click', () => {
      this.fileInput.click();
    });

    // Preset selector chips
    document.querySelectorAll('.preset-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const preset = target.dataset.preset;
        if (preset) this.loadPreset(preset);
      });
    });

    // Scale controls
    document.getElementById('btn-scale-up')?.addEventListener('click', () => {
      this.setScale(this.currentScale + 0.15);
    });

    document.getElementById('btn-scale-down')?.addEventListener('click', () => {
      this.setScale(this.currentScale - 0.15);
    });

    const scaleSlider = document.getElementById('dock-scale-slider') as HTMLInputElement;
    scaleSlider?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.setScale(val / 100);
    });

    // Rotation controls
    document.getElementById('btn-rot-left')?.addEventListener('click', () => {
      this.rotateModel(-Math.PI / 4);
    });

    document.getElementById('btn-rot-right')?.addEventListener('click', () => {
      this.rotateModel(Math.PI / 4);
    });

    document.getElementById('btn-rot-auto')?.addEventListener('click', (e) => {
      this.autoRotate = !this.autoRotate;
      (e.currentTarget as HTMLElement)?.classList.toggle('active-toggle', this.autoRotate);
    });

    // Movement controls
    document.getElementById('btn-move-closer')?.addEventListener('click', () => {
      this.moveModel(0, 0, 0.2);
    });

    document.getElementById('btn-move-farther')?.addEventListener('click', () => {
      this.moveModel(0, 0, -0.2);
    });

    document.getElementById('btn-snap-floor')?.addEventListener('click', () => {
      this.snapToFloor();
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.resetModelTransform();
    });

    // APK Install Modal events
    const apkModal = document.getElementById('apk-modal');
    document.getElementById('btn-apk')?.addEventListener('click', () => {
      if (apkModal) apkModal.style.display = 'flex';
    });
    document.getElementById('modal-close-apk')?.addEventListener('click', () => {
      if (apkModal) apkModal.style.display = 'none';
    });
    document.getElementById('modal-cancel-apk')?.addEventListener('click', () => {
      if (apkModal) apkModal.style.display = 'none';
    });
    document.getElementById('btn-trigger-pwa')?.addEventListener('click', () => {
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        this.deferredInstallPrompt.userChoice.then(() => {
          this.deferredInstallPrompt = null;
        });
      } else {
        alert(
          this.lang === 'ar'
            ? 'لتثبيت التطبيق: افتح قائمة المتصفح (⋮) في Chrome واختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية" ليصبح تطبيق مستقل على هاتفك!'
            : 'To install: Open Chrome menu (⋮) and select "Install App" or "Add to Home screen" to install as a native Android app!'
        );
      }
      if (apkModal) apkModal.style.display = 'none';
    });

    // Help Modal events
    const helpModal = document.getElementById('help-modal');
    document.getElementById('btn-help')?.addEventListener('click', () => {
      if (helpModal) helpModal.style.display = 'flex';
    });
    document.getElementById('modal-close-help')?.addEventListener('click', () => {
      if (helpModal) helpModal.style.display = 'none';
    });
    document.getElementById('modal-ok-help')?.addEventListener('click', () => {
      if (helpModal) helpModal.style.display = 'none';
    });
  }

  /**
   * Sets up drag and drop of .glb and .gltf files
   */
  private setupDragAndDrop() {
    const dropOverlay = document.getElementById('drop-overlay');

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dropOverlay) dropOverlay.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null && dropOverlay) {
        dropOverlay.classList.add('hidden');
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (dropOverlay) dropOverlay.classList.add('hidden');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        await this.loadUploadedFile(files[0]);
      }
    });
  }

  /**
   * Handles file upload from input element
   */
  private async handleFileUpload(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      await this.loadUploadedFile(files[0]);
    }
  }

  private async loadUploadedFile(file: File) {
    if (!file.name.match(/\.(glb|gltf)$/i)) {
      alert(this.lang === 'ar' ? 'يرجى اختيار ملف بصيغة .glb أو .gltf' : 'Please select a .glb or .gltf file');
      return;
    }

    try {
      this.updateStatusText(this.lang === 'ar' ? `جاري تحميل ${file.name}...` : `Loading ${file.name}...`);
      const { object, metadata } = await this.modelLoader.loadFromFile(file);
      this.presentModel(object, metadata);
    } catch (err: any) {
      console.error(err);
      alert(translations[this.lang].errorLoading);
    }
  }

  /**
   * Loads curated sample models
   */
  private async loadPreset(preset: string) {
    try {
      this.updateStatusText(translations[this.lang].loadingModel);

      if (preset === 'mech') {
        const { object, metadata } = createSciFiMech();
        this.presentModel(object, metadata);
      } else if (preset === 'chair') {
        const { object, metadata } = createModernLoungeChair();
        this.presentModel(object, metadata);
      } else if (preset === 'earth') {
        const { object, metadata } = createPlanetEarth();
        this.presentModel(object, metadata);
      } else if (preset === 'sculpture') {
        const { object, metadata } = createTorusSculpture();
        this.presentModel(object, metadata);
      } else if (preset === 'cat') {
        const catUrl = `${ASSETS_BASE_URL}models/Cat/cat.gltf`;
        const { object, metadata } = await this.modelLoader.loadFromUrl(catUrl, 'Cute Cat');
        this.presentModel(object, metadata);
      } else if (preset === 'dino') {
        const dinoUrl = `${ASSETS_BASE_URL}models/Parasaurolophus.glb`;
        const { object, metadata } = await this.modelLoader.loadFromUrl(dinoUrl, 'Parasaurolophus Dino');
        this.presentModel(object, metadata);
      }
    } catch (err) {
      console.warn('Fallback to procedural mech:', err);
      const { object, metadata } = createSciFiMech();
      this.presentModel(object, metadata);
    }
  }

  private presentModel(object: THREE.Object3D, metadata: ModelMetadata) {
    this.currentObject = object;
    this.activeMetadata = metadata;

    // Place content into ModelViewer
    this.modelViewer.setContent(object);

    // Reset current scale state to 1.0
    this.currentScale = 1.0;
    this.modelViewer.scale.setScalar(1.0);

    this.updateBadge();
    this.updateStatusText(translations[this.lang].modelReady);
  }

  private updateBadge() {
    const nameEl = document.getElementById('badge-name');
    const statsEl = document.getElementById('badge-stats');
    if (nameEl && this.activeMetadata) {
      nameEl.textContent = this.activeMetadata.name;
    }
    if (statsEl && this.activeMetadata) {
      const approxWidth = Math.round(this.activeMetadata.dimensions.x * 100 * this.currentScale);
      statsEl.textContent = `(${this.activeMetadata.triangleCount.toLocaleString()} ▲ • ${approxWidth}cm)`;
    }
  }

  private updateStatusText(text: string) {
    if (this.spatialStatusText) {
      this.spatialStatusText.text = text;
    }
  }

  // --- Transform & Manipulation Handlers ---

  public setScale(scale: number) {
    this.currentScale = THREE.MathUtils.clamp(scale, 0.05, 8.0);
    this.modelViewer.scale.setScalar(this.currentScale);

    // Update UI readouts
    const scaleSlider = document.getElementById('dock-scale-slider') as HTMLInputElement;
    if (scaleSlider) scaleSlider.value = String(Math.round(this.currentScale * 100));

    const scaleValLabel = document.getElementById('scale-val-label');
    if (scaleValLabel) scaleValLabel.textContent = `${Math.round(this.currentScale * 100)}%`;

    if (this.spatialScaleText) {
      this.spatialScaleText.text = `${Math.round(this.currentScale * 100)}%`;
    }

    this.updateBadge();
  }

  public rotateModel(angleRad: number) {
    this.modelViewer.rotation.y += angleRad;
  }

  public moveModel(dx: number, dy: number, dz: number) {
    this.modelViewer.position.x += dx;
    this.modelViewer.position.y += dy;
    this.modelViewer.position.z += dz;
  }

  public snapToFloor() {
    this.modelViewer.position.y = 0;
  }

  public resetModelTransform() {
    this.modelViewer.position.set(0, 0, -this.initialObjectDistance);
    this.modelViewer.rotation.set(0, 0, 0);
    this.setScale(1.0);
  }

  /**
   * Set up mobile touch and mouse drag manipulation on the screen:
   * - 1 finger drag: rotate model
   * - 2 finger pinch: scale model
   * - Tap on ground: place model at hit point
   */
  private setupTouchGestures() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialPinchDistance = 0;
    let initialPinchScale = 1.0;
    let hasMoved = false;

    window.addEventListener('pointerdown', (e) => {
      // Ignore clicks on HUD interactive buttons
      if ((e.target as HTMLElement).closest('.glass-panel, .modal-backdrop, .btn-pill, button, input')) {
        return;
      }

      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      // Rotate model on horizontal drag
      this.modelViewer.rotation.y += dx * 0.01;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('pointerup', (e) => {
      if (isDragging && !hasMoved) {
        // Was a tap: Raycast to floor to place/move model
        this.handleScreenTap(e.clientX, e.clientY);
      }
      isDragging = false;
    });

    // Touch pinch-to-scale for mobile screens
    window.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          if (initialPinchDistance === 0) {
            initialPinchDistance = dist;
            initialPinchScale = this.currentScale;
          } else {
            const ratio = dist / initialPinchDistance;
            this.setScale(initialPinchScale * ratio);
          }
        }
      },
      { passive: false }
    );

    window.addEventListener('touchend', () => {
      initialPinchDistance = 0;
    });
  }

  /**
   * Places the model on floor or depth mesh on tap
   */
  private handleScreenTap(clientX: number, clientY: number) {
    const camera = xb.core.camera;
    if (!camera) return;

    this.pointer.x = (clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, camera);

    // First try depth mesh if active
    if (xb.core.depth?.depthMesh) {
      const depthIntersects = this.raycaster.intersectObject(xb.core.depth.depthMesh);
      if (depthIntersects.length > 0) {
        this.modelViewer.position.copy(depthIntersects[0].point);
        return;
      }
    }

    // Otherwise raycast against floor plane
    const intersects = this.raycaster.intersectObject(this.floorPlane);
    if (intersects.length > 0) {
      const pt = intersects[0].point;
      this.modelViewer.position.set(pt.x, 0, pt.z);
    }
  }

  /**
   * Automatically attempt to place on detected surface when XR session begins
   */
  onXRSessionStarted() {
    if (this.modelViewer) {
      xb.world?.placeOnHorizontalSurface?.(this.modelViewer, { seconds: 10 } as any).catch(() => {});
    }
  }

  onSimulatorStarted() {
    this.onXRSessionStarted();
  }

  /**
   * XR Controller / Hand selection for spatial placement
   */
  onSelectStart(event: xb.SelectEvent) {
    if (event.intersection) {
      // Place at the selected point on surface or floor
      this.modelViewer.position.copy(event.intersection.point);
    }
  }

  /**
   * PWA BeforeInstallPrompt for Android WebAPK
   */
  private setupPwaInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      const apkBtn = document.getElementById('btn-apk');
      if (apkBtn) {
        apkBtn.style.animation = 'pulse-dot 2s infinite';
      }
    });
  }

  /**
   * Frame update loop
   */
  update() {
    super.update();

    // Auto rotate model if enabled
    if (this.autoRotate && this.modelViewer) {
      this.modelViewer.rotation.y += 0.01;
    }
  }

  dispose() {
    super.dispose();
    this.floorPlane.geometry.dispose();
    (this.floorPlane.material as THREE.Material).dispose();
  }
}

// Initialize XR Blocks with broad device compatibility (no mandatory depth-sensing)
document.addEventListener('DOMContentLoaded', () => {
  const options = new xb.Options();
  // Do NOT call enableDepth() as depth-sensing is a requiredFeature in XRBlocks
  // and causes session failure on devices without hardware LiDAR / depth sensors.
  options.enableHands();
  options.world.enablePlaneDetection();
  options.reticles.enabled = true;
  options.webxrOptionalFeatures.push('hit-test');
  options.xrButton.showEnterSimulatorButton = true;
  options.simulator.defaultMode = xb.SimulatorMode.CONTROLLER;
  options.setAppTitle('WebAR 3D Placer');
  options.setAppDescription('Upload and place any 3D model in Augmented Reality on Android & XR devices');

  xb.add(new WebARScene());
  xb.init(options);
});
