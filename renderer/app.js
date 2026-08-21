const App = {
  canvas: null,
  ctx: null,
  elements: [],
  selectedIds: new Set(),
  hoveredElement: null,
  currentTool: 'pointer',
  history: new History(50),
  panX: 0,
  panY: 0,
  zoom: 1,
  currentWidth: 2,
  pendingTextPos: null,
  currentColor: '#e2e8f0',
  theme: 'dark',
  spaceDown: false,
  TOOL_NAMES: {
    pointer: 'Pointer / Select',
    candle: 'Candle',
    line: 'Line',
    arrow: 'Arrow',
    rect: 'Rectangle',
    text: 'Text',
    pencil: 'Freehand Pencil',
    long: 'Long Position',
    short: 'Short Position',
    eraser: 'Eraser',
  },

  async init() {
    this.loadTheme();
    this.canvas = document.getElementById('chart-canvas');
    this.ctx = this.canvas.getContext('2d');

    ChartRenderer.init(this.canvas);
    ToolManager.init(this);

    this.setupCanvasEvents();
    this.setupToolbar();
    this.setupKeyboard();
    this.setupTextInput();
    this.setupConfirmDialog();

    this.render();

    document.getElementById('loading-overlay').classList.add('hidden');

    window.addEventListener('resize', () => {
      ChartRenderer.resize();
      this.render();
    });
  },

  uid() {
    return (typeof uid === 'function' ? uid() : (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8)));
  },

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ChartRenderer.width, ChartRenderer.height);
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    const previewEl = ToolManager.state.preview;

    const drawElements = [...this.elements];
    if (previewEl) drawElements.push(previewEl);

    const hovered = this.currentTool === 'eraser' ? null : this.hoveredElement;
    ChartRenderer.render(drawElements, hovered, this.selectedIds, this.panX, this.panY, this.zoom);

    if (ToolManager.state.marqueeActive && ToolManager.state.marquee) {
      const m = ToolManager.state.marquee;
      const mx = Math.min(m.sx, m.ex);
      const my = Math.min(m.sy, m.ey);
      const mw = Math.abs(m.ex - m.sx);
      const mh = Math.abs(m.ey - m.sy);
      ctx.fillStyle = 'rgba(99,102,241,0.12)';
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(mx, my, mw, mh);
      ctx.setLineDash([]);
    }

    if (this.currentTool === 'eraser' && this.hoveredElement) {
      ChartRenderer.drawEraserPreview(ctx, this.hoveredElement);
    }

    ctx.restore();
    this.updateHistoryButtons();
  },

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    const status = document.getElementById('tool-status');
    if (status) {
      status.textContent = this.TOOL_NAMES[tool] || tool;
    }

    const canvas = this.canvas;
    canvas.classList.toggle('pointer-cursor', tool === 'pointer');
    canvas.classList.toggle('eraser-cursor', tool === 'eraser');
    canvas.style.cursor = tool === 'eraser' ? '' :
                          tool === 'pointer' ? 'default' :
                          tool === 'text' ? 'text' :
                          tool === 'pencil' ? 'crosshair' : 'crosshair';
  },

  setupCanvasEvents() {
    this.canvas.addEventListener('mousedown', (e) => ToolManager.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => ToolManager.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => ToolManager.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => {
      ToolManager.state.marqueeActive = false;
      ToolManager.state.marquee = null;
      if (!ToolManager.state.active) {
        ToolManager.state.active = false;
        ToolManager.state.preview = null;
        this.hoveredElement = null;
        this.render();
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.zoomAt(sx, sy, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    });
  },

  zoomAt(sx, sy, factor) {
    const oldZoom = this.zoom;
    const newZoom = Math.min(4, Math.max(0.25, oldZoom * factor));
    if (newZoom === oldZoom) return;
    const wx = (sx - this.panX) / oldZoom;
    const wy = (sy - this.panY) / oldZoom;
    this.zoom = newZoom;
    this.panX = sx - wx * newZoom;
    this.panY = sy - wy * newZoom;
    this.render();
  },

  setupToolbar() {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });

    document.getElementById('undo-btn').addEventListener('click', () => this.undo());
    document.getElementById('redo-btn').addEventListener('click', () => this.redo());
    document.getElementById('clear-btn').addEventListener('click', () => this.clearAll());
    document.getElementById('export-btn').addEventListener('click', () => this.exportPNG());
    document.getElementById('theme-btn').addEventListener('click', () => this.toggleTheme());

    if (window.electronAPI) {
      window.electronAPI.onSaveRequest(() => this.saveProject());
      window.electronAPI.onLoadRequest(() => this.loadProject());
    }

    document.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
      });
    });

    const customColor = document.getElementById('custom-color');
    customColor.addEventListener('input', () => {
      this.currentColor = customColor.value;
      document.querySelectorAll('.color-swatch[data-color]').forEach(b => b.classList.remove('active'));
      document.getElementById('custom-color-wrap').classList.add('active');
    });

    const slider = document.getElementById('width-slider');
    const widthVal = document.getElementById('width-value');
    slider.addEventListener('input', () => {
      this.currentWidth = parseInt(slider.value, 10);
      widthVal.textContent = this.currentWidth;
    });
  },

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      if (e.ctrlKey && e.shiftKey && key === 'z') {
        e.preventDefault();
        this.redo();
        return;
      }
      if (e.ctrlKey && key === 'z') {
        e.preventDefault();
        this.undo();
        return;
      }
      if (e.ctrlKey && key === 's') {
        e.preventDefault();
        this.saveProject();
        return;
      }
      if (e.ctrlKey && key === 'e') {
        e.preventDefault();
        this.exportPNG();
        return;
      }
      if (e.ctrlKey && key === 'a') {
        e.preventDefault();
        this.selectedIds = new Set(this.elements.map((el) => el.id));
        this.render();
        return;
      }
      if (e.ctrlKey && key === 'd') {
        e.preventDefault();
        if (this.selectedIds.size > 0) {
          this.selectedIds.clear();
          this.render();
        }
        return;
      }
      if (key === ' ') {
        e.preventDefault();
        this.spaceDown = true;
        return;
      }
      if (key === 'v') { this.setTool('pointer'); return; }
      if (key === 'c') { this.setTool('candle'); return; }
      if (key === 'l') { this.setTool('line'); return; }
      if (key === 'a') { this.setTool('arrow'); return; }
      if (key === 'r') { this.setTool('rect'); return; }
      if (key === 't') { this.setTool('text'); return; }
      if (key === 'p') { this.setTool('pencil'); return; }
      if (key === 'b') { this.setTool('long'); return; }
      if (key === 's') { this.setTool('short'); return; }
      if (key === 'e') { this.setTool('eraser'); return; }

      if (key === 'delete' || key === 'backspace') {
        if (this.selectedIds.size > 0) {
          this.elements = this.elements.filter(el => !this.selectedIds.has(el.id));
          this.selectedIds.clear();
          this.history.push(this.snapshot());
          this.render();
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === ' ') this.spaceDown = false;
    });
  },

  hintPanned() {
    const hint = document.getElementById('pan-hint');
    if (hint && !hint.classList.contains('faded')) hint.classList.add('faded');
  },

  setupTextInput() {
    const overlay = document.getElementById('text-input-overlay');
    const input = document.getElementById('text-input');
    const confirmBtn = document.getElementById('text-confirm');
    const cancelBtn = document.getElementById('text-cancel');

    const commitText = () => {
      const text = input.value.trim();
      if (text && this.pendingTextPos) {
        this.elements.push({
          id: this.uid(),
          type: 'text',
          x: this.pendingTextPos.x,
          y: this.pendingTextPos.y,
          text: text,
          color: this.currentColor,
          fontSize: 14,
        });
        this.selectedIds.clear();
        this.selectedIds.add(this.elements[this.elements.length - 1].id);
        this.history.push(this.snapshot());
        this.render();
        this.setTool('pointer');
        this.render();
      }
      overlay.classList.add('hidden');
      this.pendingTextPos = null;
      input.value = '';
    };

    confirmBtn.addEventListener('click', commitText);
    cancelBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      this.pendingTextPos = null;
      input.value = '';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitText();
      }
      if (e.key === 'Escape') {
        overlay.classList.add('hidden');
        this.pendingTextPos = null;
        input.value = '';
      }
    });
  },

  showTextInput(worldX, worldY) {
    const overlay = document.getElementById('text-input-overlay');
    const input = document.getElementById('text-input');
    const screenX = worldX * this.zoom + this.panX;
    const screenY = worldY * this.zoom + this.panY;
    overlay.classList.remove('hidden');
    overlay.style.left = Math.min(screenX, ChartRenderer.width - 220) + 'px';
    overlay.style.top = Math.min(screenY, ChartRenderer.height - 100) + 'px';
    setTimeout(() => input.focus(), 50);
  },

  undo() {
    if (this.history.canUndo()) {
      this.elements = this.history.undo().map(el => structuredClone(el));
      this.selectedIds.clear();
      this.render();
    }
  },

  redo() {
    if (this.history.canRedo()) {
      this.elements = this.history.redo().map(el => structuredClone(el));
      this.selectedIds.clear();
      this.render();
    }
  },

  clearAll() {
    if (this.elements.length === 0) return;
    const overlay = document.getElementById('confirm-overlay');
    if (overlay) overlay.classList.remove('hidden');
  },

  setupConfirmDialog() {
    const overlay = document.getElementById('confirm-overlay');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    const hide = () => overlay.classList.add('hidden');
    okBtn.addEventListener('click', () => {
      this.elements = [];
      this.selectedIds.clear();
      this.history.push([]);
      this.render();
      hide();
    });
    cancelBtn.addEventListener('click', hide);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hide();
    });
  },

  updateHistoryButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (!undoBtn || !redoBtn) return;
    undoBtn.disabled = !this.history.canUndo();
    redoBtn.disabled = !this.history.canRedo();
  },

  snapshot() {
    return (typeof structuredClone === 'function')
      ? structuredClone(this.elements)
      : JSON.parse(JSON.stringify(this.elements));
  },

  async saveProject() {
    const data = {
      version: 1,
      app: 'snip-draw-tool',
      theme: this.theme,
      elements: this.elements,
    };
    if (window.electronAPI) {
      await window.electronAPI.saveProject(data);
      return;
    }
    const link = document.createElement('a');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    link.download = `snip-draw-project-${stamp}.json`;
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    link.click();
    URL.revokeObjectURL(link.href);
  },

  async loadProject() {
    if (window.electronAPI) {
      const res = await window.electronAPI.loadProject();
      if (!res.ok) return;
      try {
        this.applyProject(JSON.parse(res.content));
      } catch (err) {
        alert('Proje dosyası okunamadı: ' + err.message);
      }
    }
  },

  applyProject(data) {
    if (!data || !Array.isArray(data.elements)) {
      alert('Geçersiz proje dosyası.');
      return;
    }
    if (data.theme === 'light' || data.theme === 'dark') {
      this.theme = data.theme;
      document.documentElement.setAttribute('data-theme', this.theme);
      this.updateThemeIcon();
      this.syncActiveSwatch();
    }
    this.elements = data.elements;
    this.selectedIds.clear();
    this.history = new History(50);
    this.history.push(this.snapshot());
    this.render();
  },

  exportPNG() {
    const scale = 2;
    const logicalW = this.canvas.width / ChartRenderer.dpr;
    const logicalH = this.canvas.height / ChartRenderer.dpr;
    const off = document.createElement('canvas');
    off.width = Math.round(logicalW * scale);
    off.height = Math.round(logicalH * scale);
    const octx = off.getContext('2d');
    octx.setTransform(scale, 0, 0, scale, 0, 0);
    octx.translate(this.panX, this.panY);
    octx.scale(this.zoom, this.zoom);
    ChartRenderer.renderTo(octx, logicalW, logicalH, this.elements, null, this.selectedIds, this.panX, this.panY, this.zoom);
    const link = document.createElement('a');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    link.download = `price-action-chart-${stamp}.png`;
    link.href = off.toDataURL('image/png');
    link.click();
  },

  loadTheme() {
    const saved = localStorage.getItem('snip-draw-theme');
    this.theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    ChartRenderer.setTheme(this.theme);
    if (this.theme === 'light') this.currentColor = '#1e293b';
    this.syncActiveSwatch();
    this.updateThemeIcon();
  },

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('snip-draw-theme', this.theme);
    ChartRenderer.setTheme(this.theme);
    if (this.theme === 'light' && this.currentColor === '#e2e8f0') {
      this.currentColor = '#1e293b';
    } else if (this.theme === 'dark' && this.currentColor === '#1e293b') {
      this.currentColor = '#e2e8f0';
    }
    this.syncActiveSwatch();
    this.render();
    this.updateThemeIcon();
  },

  syncActiveSwatch() {
    const custom = document.getElementById('custom-color');
    const wrap = document.getElementById('custom-color-wrap');
    let matched = false;
    document.querySelectorAll('.color-swatch[data-color]').forEach(btn => {
      const is = btn.dataset.color === this.currentColor;
      btn.classList.toggle('active', is);
      if (is) matched = true;
    });
    if (wrap) {
      wrap.classList.toggle('active', !matched);
      wrap.style.background = matched ? '' : this.currentColor;
    }
    if (custom && !matched && custom.value.toLowerCase() !== this.currentColor.toLowerCase()) {
      custom.value = this.currentColor;
    }
  },

  updateThemeIcon() {
    const btn = document.getElementById('theme-btn');
    if (!btn) return;
    if (this.theme === 'dark') {
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/></svg>';
      btn.title = 'Switch to Light Mode';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="5" fill="currentColor"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      btn.title = 'Switch to Dark Mode';
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
