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
  pendingTextPos: null,
  currentColor: '#e2e8f0',
  theme: 'dark',

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

    this.render();

    document.getElementById('loading-overlay').classList.add('hidden');

    window.addEventListener('resize', () => {
      ChartRenderer.resize();
      this.render();
    });
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ChartRenderer.width, ChartRenderer.height);
    ctx.save();
    ctx.translate(this.panX, this.panY);

    const previewEl = ToolManager.state.preview;

    const drawElements = [...this.elements];
    if (previewEl) drawElements.push(previewEl);

    ChartRenderer.render(drawElements, this.hoveredElement, this.selectedIds, null);

    ctx.restore();
  },

  setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    const canvas = this.canvas;
    canvas.classList.toggle('pointer-cursor', tool === 'pointer');
    canvas.classList.toggle('eraser-cursor', tool === 'eraser');
    canvas.style.cursor = tool === 'eraser' ? 'not-allowed' :
                          tool === 'pointer' ? 'default' :
                          tool === 'text' ? 'text' :
                          tool === 'pencil' ? 'crosshair' : 'crosshair';
  },

  setupCanvasEvents() {
    this.canvas.addEventListener('mousedown', (e) => ToolManager.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => ToolManager.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => ToolManager.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => {
      if (!ToolManager.state.active) {
        ToolManager.state.active = false;
        ToolManager.state.preview = null;
        this.hoveredElement = null;
        this.render();
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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

    document.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
      });
    });
  },

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
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
          this.history.push(this.elements.map(el => ({ ...el })));
          this.render();
        }
      }
    });
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
        this.history.push(this.elements.map(el => ({ ...el })));
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
    const screenX = worldX + this.panX;
    const screenY = worldY + this.panY;
    overlay.classList.remove('hidden');
    overlay.style.left = Math.min(screenX, ChartRenderer.width - 220) + 'px';
    overlay.style.top = Math.min(screenY, ChartRenderer.height - 100) + 'px';
    setTimeout(() => input.focus(), 50);
  },

  undo() {
    if (this.history.canUndo()) {
      this.elements = this.history.undo().map(el => ({ ...el }));
      this.selectedIds.clear();
      this.render();
    }
  },

  redo() {
    if (this.history.canRedo()) {
      this.elements = this.history.redo().map(el => ({ ...el }));
      this.selectedIds.clear();
      this.render();
    }
  },

  clearAll() {
    if (this.elements.length === 0) return;
    this.elements = [];
    this.selectedIds.clear();
    this.history.push([]);
    this.render();
  },

  exportPNG() {
    const link = document.createElement('a');
    link.download = 'price-action-chart.png';
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  },

  loadTheme() {
    const saved = localStorage.getItem('snip-draw-theme');
    this.theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    ChartRenderer.setTheme(this.theme);
    if (this.theme === 'light') this.currentColor = '#1e293b';
    this.updateThemeIcon();
  },

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('snip-draw-theme', this.theme);
    ChartRenderer.setTheme(this.theme);
    this.render();
    this.updateThemeIcon();
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
