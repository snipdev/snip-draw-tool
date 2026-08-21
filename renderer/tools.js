function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const HIT = {
  SELECT: 20,
  HANDLE_CANDLE: 4,
  HANDLE_TEXT: 6,
  HANDLE_RECT: 6,
  HANDLE_POSITION: 8,
  HANDLE_LINE: 8,
};

const MIN = {
  RECT: 10,
  CANDLE_WIDTH: 6,
};

const ToolManager = {
  app: null,
  state: {
    active: false,
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
    preview: null,
    isPanning: false,
    panStartX: 0, panStartY: 0,
    dragElIndex: -1,
    dragOffsetX: 0, dragOffsetY: 0,
    dragStartX: 0, dragStartY: 0,
    pointerMoved: false,
    historyCaptured: false,
    pencilPoints: [],
  },
  resizeState: {
    active: false,
    elIndex: -1,
    handleType: null,
  },

  init(app) {
    this.app = app;
  },

  getMouseWorld(e) {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const z = this.app.zoom || 1;
    return {
      screenX,
      screenY,
      worldX: (screenX - this.app.panX) / z,
      worldY: (screenY - this.app.panY) / z,
    };
  },

  onMouseDown(e) {
    const app = this.app;
    this.state.historyCaptured = false;
    const { screenX, screenY, worldX, worldY } = this.getMouseWorld(e);

    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && app.spaceDown)) {
      this.state.isPanning = true;
      this.state.panStartX = screenX - app.panX;
      this.state.panStartY = screenY - app.panY;
      if (typeof app.hintPanned === 'function') app.hintPanned();
      return;
    }

    if (e.button !== 0) return;

    const tool = app.currentTool;

    if (tool === 'eraser') {
      const idx = this.findNearest(worldX, worldY);
      if (idx !== -1) {
        app.elements.splice(idx, 1);
        app.history.push(app.snapshot());
        app.render();
      } else {
        this.state.isPanning = true;
        this.state.panStartX = screenX - app.panX;
        this.state.panStartY = screenY - app.panY;
        if (typeof app.hintPanned === 'function') app.hintPanned();
      }
      return;
    }

    if (tool === 'pointer') {
      const idx = this.findNearest(worldX, worldY);
      if (idx !== -1) {
        const el = app.elements[idx];
        if (e.shiftKey) {
          if (app.selectedIds.has(el.id)) {
            app.selectedIds.delete(el.id);
            app.render();
            return;
          }
          app.selectedIds.add(el.id);
        } else {
          app.selectedIds.clear();
          app.selectedIds.add(el.id);
        }
        if (el.type === 'candle') {
          const handle = this.findHandle(worldX, worldY, el);
          if (handle) {
            this.resizeState.active = true;
            this.resizeState.elIndex = idx;
            this.resizeState.handleType = handle;
            this.state.pointerMoved = false;
            app.render();
            return;
          }
        }
        if (el.type === 'text') {
          const handle = this.findTextHandle(worldX, worldY, el);
          if (handle) {
            this.resizeState.active = true;
            this.resizeState.elIndex = idx;
            this.resizeState.handleType = 'fontSize';
            this.state.pointerMoved = false;
            app.render();
            return;
          }
        }
        if (el.type === 'rect') {
          const handle = this.findRectHandle(worldX, worldY, el);
          if (handle) {
            this.resizeState.active = true;
            this.resizeState.elIndex = idx;
            this.resizeState.handleType = handle;
            this.state.pointerMoved = false;
            app.render();
            return;
          }
        }
        if (el.type === 'line' || el.type === 'arrow') {
          const handle = this.findLineHandle(worldX, worldY, el);
          if (handle) {
            this.resizeState.active = true;
            this.resizeState.elIndex = idx;
            this.resizeState.handleType = handle;
            this.state.pointerMoved = false;
            app.render();
            return;
          }
        }
        if (el.type === 'position') {
          const handle = this.findPositionHandle(worldX, worldY, el);
          if (handle) {
            this.resizeState.active = true;
            this.resizeState.elIndex = idx;
            this.resizeState.handleType = handle;
            this.state.pointerMoved = false;
            app.render();
            return;
          }
        }
        this.state.active = true;
        this.state.dragElIndex = idx;
        this.state.dragOffsetX = worldX;
        this.state.dragOffsetY = worldY;
        this.state.dragStartX = worldX;
        this.state.dragStartY = worldY;
        this.state.pointerMoved = false;
        app.render();
      } else if (e.shiftKey) {
        this.state.marqueeActive = true;
        this.state.marquee = { sx: worldX, sy: worldY, ex: worldX, ey: worldY };
      } else {
        app.selectedIds.clear();
        this.state.isPanning = true;
        this.state.panStartX = screenX - app.panX;
        this.state.panStartY = screenY - app.panY;
        if (typeof app.hintPanned === 'function') app.hintPanned();
        app.render();
      }
      return;
    }

    if (tool === 'text') {
      app.pendingTextPos = { x: worldX, y: worldY };
      app.showTextInput(worldX, worldY);
      return;
    }

    if (tool === 'long' || tool === 'short') {
      const isLong = tool === 'long';
      this.state.active = true;
      this.state.startX = worldX;
      this.state.startY = worldY;
      this.state.preview = {
        type: 'position',
        direction: tool,
        x: worldX,
        y: worldY,
        slY: worldY + (isLong ? 30 : -30),
        tpY: worldY + (isLong ? -30 : 30),
        color: app.currentColor,
      };
      return;
    }

    if (tool === 'pencil') {
      this.state.pencilPoints = [{ x: worldX, y: worldY }];
      this.state.preview = {
        type: 'pencil',
        points: [{ x: worldX, y: worldY }],
        color: app.currentColor,
        width: app.currentWidth,
      };
      this.state.active = true;
      return;
    }

    this.state.active = true;
    this.state.startX = worldX;
    this.state.startY = worldY;
    this.state.currentX = worldX;
    this.state.currentY = worldY;
    this.state.preview = null;
  },

  captureHistoryOnce() {
    if (this.state.historyCaptured) return;
    this.state.historyCaptured = true;
    this.app.history.push(this.app.snapshot());
  },

  onMouseMove(e) {
    const app = this.app;
    const { screenX, screenY, worldX, worldY } = this.getMouseWorld(e);

    if (this.state.isPanning) {
      app.panX = screenX - this.state.panStartX;
      app.panY = screenY - this.state.panStartY;
      app.render();
      return;
    }

    if (this.state.marqueeActive) {
      this.state.marquee.ex = worldX;
      this.state.marquee.ey = worldY;
      app.render();
      return;
    }

    if (this.resizeState.active) {
      const el = app.elements[this.resizeState.elIndex];
      if (el) {
        this.state.pointerMoved = true;
        this.captureHistoryOnce();
      }
      if (el && el.type === 'text' && this.resizeState.handleType === 'fontSize') {
        const newSize = Math.max(8, Math.round((worldY - el.y) / 1.3));
        el.fontSize = newSize;
        this.state.pointerMoved = true;
        app.render();
      } else if (el && el.type === 'rect') {
        const bx = el.x, by = el.y, bw = el.w, bh = el.h;
        const left = Math.min(bx, bx + bw);
        const top = Math.min(by, by + bh);
        const right = Math.max(bx, bx + bw);
        const bottom = Math.max(by, by + bh);
        let nl = left, nt = top, nr = right, nb = bottom;
        switch (this.resizeState.handleType) {
          case 'nw': nl = worldX; nt = worldY; break;
          case 'ne': nr = worldX; nt = worldY; break;
          case 'sw': nl = worldX; nb = worldY; break;
          case 'se': nr = worldX; nb = worldY; break;
        }
        if (nr - nl >= MIN.RECT) { el.x = nl; el.w = nr - nl; }
        if (nb - nt >= MIN.RECT) { el.y = nt; el.h = nb - nt; }
        this.state.pointerMoved = true;
        app.render();
      } else if (el && (el.type === 'line' || el.type === 'arrow')) {
        if (this.resizeState.handleType === 'start') { el.x1 = worldX; el.y1 = worldY; }
        else if (this.resizeState.handleType === 'end') { el.x2 = worldX; el.y2 = worldY; }
        this.state.pointerMoved = true;
        app.render();
      } else if (el && el.type === 'position') {
        switch (this.resizeState.handleType) {
          case 'sl':
            el.slY = el.direction === 'long' ? Math.max(el.y, worldY) : Math.min(el.y, worldY);
            break;
          case 'tp':
            el.tpY = el.direction === 'long' ? Math.min(el.y, worldY) : Math.max(el.y, worldY);
            break;
          case 'entry': {
            el.y = worldY;
            if (el.direction === 'long') {
              el.slY = Math.max(el.y, el.slY);
              el.tpY = Math.min(el.y, el.tpY);
            } else {
              el.slY = Math.min(el.y, el.slY);
              el.tpY = Math.max(el.y, el.tpY);
            }
            break;
          }
        }
        this.state.pointerMoved = true;
        app.render();
      } else if (el && el.type === 'candle') {
        const bodyTop = Math.min(el.open, el.close);
        const bodyBot = Math.max(el.open, el.close);
        switch (this.resizeState.handleType) {
          case 'high':
            el.high = worldY;
            break;
          case 'low':
            el.low = worldY;
            break;
          case 'bodyTop':
            if (el.open < el.close) el.close = worldY;
            else el.open = worldY;
            break;
          case 'bodyBot':
            if (el.open > el.close) el.close = worldY;
            else el.open = worldY;
            break;
          case 'left': {
            const rightEdge = el.x + el.width / 2;
            const newW = rightEdge - worldX;
            if (newW > MIN.CANDLE_WIDTH) { el.width = newW; el.x = worldX + newW / 2; }
            break;
          }
          case 'right': {
            const leftEdge = el.x - el.width / 2;
            const newW = worldX - leftEdge;
            if (newW > MIN.CANDLE_WIDTH) { el.width = newW; el.x = leftEdge + newW / 2; }
            break;
          }
        }
        this.state.pointerMoved = true;
        app.render();
      }
      return;
    }

    if (this.state.active && app.currentTool === 'pointer' && this.state.dragElIndex >= 0) {
      this.state.pointerMoved = true;
      this.captureHistoryOnce();
      const el = app.elements[this.state.dragElIndex];
      if (el) {
        const dx = worldX - this.state.dragOffsetX;
        const dy = worldY - this.state.dragOffsetY;
        if (el.type === 'candle') {
          el.x += dx;
          el.open += dy; el.close += dy;
          el.high += dy; el.low += dy;
        } else if (el.type === 'line' || el.type === 'arrow') {
          el.x1 += dx; el.y1 += dy;
          el.x2 += dx; el.y2 += dy;
        } else if (el.type === 'position') {
          el.x += dx; el.y += dy; el.slY += dy; el.tpY += dy;
        } else {
          el.x += dx; el.y += dy;
        }
        this.state.dragOffsetX = worldX;
        this.state.dragOffsetY = worldY;
        app.render();
      }
      return;
    }

    if (!this.state.active) {
      if (app.currentTool === 'eraser' || app.currentTool === 'pointer') {
        const idx = this.findNearest(worldX, worldY);
        if (idx !== -1) {
          app.hoveredElement = app.elements[idx];
        } else {
          app.hoveredElement = null;
        }
        app.render();
      }
      return;
    }

    this.state.currentX = worldX;
    this.state.currentY = worldY;

    const sx = this.state.startX;
    const sy = this.state.startY;

    switch (app.currentTool) {
      case 'candle': {
        const bodyH = Math.abs(worldY - sy);
        const wickExt = Math.max(8, bodyH * 0.2);
        this.state.preview = {
          type: 'candle',
          x: sx,
          open: sy,
          close: worldY,
          high: Math.min(sy, worldY) - wickExt,
          low: Math.max(sy, worldY) + wickExt,
          width: 20,
        };
        break;
      }
      case 'line':
        this.state.preview = {
          type: 'line', x1: sx, y1: sy, x2: worldX, y2: worldY,
          color: app.currentColor, width: app.currentWidth,
        };
        break;
      case 'arrow':
        this.state.preview = {
          type: 'arrow', x1: sx, y1: sy, x2: worldX, y2: worldY,
          color: app.currentColor, width: app.currentWidth,
        };
        break;
      case 'rect':
        this.state.preview = {
          type: 'rect', x: sx, y: sy, w: worldX - sx, h: worldY - sy,
          color: app.currentColor, fill: true,
          fillColor: hexToRGBA(app.currentColor, 0.12),
        };
        break;
      case 'long':
      case 'short': {
        const dist = Math.max(10, Math.abs(worldY - sy));
        const isLong = app.currentTool === 'long';
        this.state.preview = {
          type: 'position',
          direction: app.currentTool,
          x: sx,
          y: sy,
          slY: isLong ? sy + dist : sy - dist,
          tpY: isLong ? sy - dist : sy + dist,
          color: app.currentColor,
        };
        break;
      }
      case 'pencil':
        this.state.pencilPoints.push({ x: worldX, y: worldY });
        this.state.preview = {
          type: 'pencil',
          points: [...this.state.pencilPoints],
          color: app.currentColor,
          width: app.currentWidth,
        };
        break;
    }

    app.render();
  },

  onMouseUp(e) {
    const app = this.app;

    if (this.state.isPanning) {
      this.state.isPanning = false;
      return;
    }

    if (this.state.marqueeActive) {
      this.state.marqueeActive = false;
      const m = this.state.marquee;
      this.state.marquee = null;
      if (!e.shiftKey) app.selectedIds.clear();
      const lx = Math.min(m.sx, m.ex);
      const ty = Math.min(m.sy, m.ey);
      const rx = Math.max(m.sx, m.ex);
      const by = Math.max(m.sy, m.ey);
      for (const el of app.elements) {
        const b = ChartRenderer.getBounds(el);
        if (b.x <= rx && b.x + b.w >= lx && b.y <= by && b.y + b.h >= ty) {
          app.selectedIds.add(el.id);
        }
      }
      app.render();
      return;
    }

    if (this.resizeState.active) {
      this.resizeState.active = false;
      this.resizeState.elIndex = -1;
      this.resizeState.handleType = null;
      if (this.state.pointerMoved) {
        app.history.push(app.snapshot());
      }
      this.state.pointerMoved = false;
      this.state.historyCaptured = false;
      app.render();
      return;
    }

    if (app.currentTool === 'pointer' && this.state.dragElIndex >= 0) {
      this.state.active = false;
      if (this.state.pointerMoved) {
        app.history.push(app.snapshot());
      }
      this.state.historyCaptured = false;
      this.state.dragElIndex = -1;
      return;
    }

    if (!this.state.active) return;

    this.state.active = false;

    if (this.state.preview) {
      if (this.state.preview.type === 'pencil') {
        this.state.preview.points = this.simplifyPencil(this.state.preview.points, 2 / app.zoom);
      }
      const el = { ...this.state.preview, id: app.uid() };
      app.elements.push(el);
      if (el.type !== 'candle') {
        app.selectedIds.clear();
        app.selectedIds.add(el.id);
      }
      app.history.push(app.snapshot());
      this.state.preview = null;
      app.render();
      if (el.type !== 'candle') {
        app.setTool('pointer');
      }
    }
  },

  simplifyPencil(points, tol) {
    if (points.length < 3) return points;
    let maxDist = 0;
    let index = 0;
    const first = points[0];
    const last = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
      const d = this.perpDist(points[i], first, last);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > tol) {
      const left = this.simplifyPencil(points.slice(0, index + 1), tol);
      const right = this.simplifyPencil(points.slice(index), tol);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  },

  perpDist(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
  },

  findNearest(x, y) {
    const app = this.app;
    let minDist = HIT.SELECT;
    let nearestIdx = -1;

    for (let i = app.elements.length - 1; i >= 0; i--) {
      const el = app.elements[i];
      const d = this.distanceTo(x, y, el);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }
    return nearestIdx;
  },

  findHandle(x, y, candle) {
    const handles = ChartRenderer.getCandleHandles(candle);
    const threshold = HIT.HANDLE_CANDLE;
    let nearest = null;
    let minDist = threshold;
    for (const h of handles) {
      const d = Math.hypot(x - h.cx, y - h.cy);
      if (d < minDist) {
        minDist = d;
        nearest = h.type;
      }
    }
    return nearest;
  },

  findTextHandle(x, y, el) {
    const ctx = ChartRenderer.ctx;
    const h = ChartRenderer.getTextHandle(el, ctx);
    const d = Math.hypot(x - h.cx, y - h.cy);
    return d < HIT.HANDLE_TEXT ? 'fontSize' : null;
  },

  findRectHandle(x, y, el) {
    const handles = ChartRenderer.getRectHandles(el);
    const threshold = HIT.HANDLE_RECT;
    for (const h of handles) {
      const d = Math.hypot(x - h.cx, y - h.cy);
      if (d < threshold) return h.type;
    }
    return null;
  },

  findPositionHandle(x, y, el) {
    const handles = ChartRenderer.getPositionHandles(el);
    const threshold = HIT.HANDLE_POSITION;
    for (const h of handles) {
      const d = Math.hypot(x - h.cx, y - h.cy);
      if (d < threshold) return h.type;
    }
    const lineLen = 120;
    if (x >= el.x - 4 && x <= el.x + lineLen + 4) {
      if (Math.abs(y - el.slY) < HIT.HANDLE_TEXT) return 'sl';
      if (Math.abs(y - el.tpY) < HIT.HANDLE_TEXT) return 'tp';
    }
    return null;
  },

  findLineHandle(x, y, el) {
    const d1 = Math.hypot(x - el.x1, y - el.y1);
    const d2 = Math.hypot(x - el.x2, y - el.y2);
    if (d1 < HIT.HANDLE_LINE) return 'start';
    if (d2 < HIT.HANDLE_LINE) return 'end';
    return null;
  },

  distanceTo(x, y, el) {
    switch (el.type) {
      case 'candle': {
        const top = Math.min(el.high, Math.min(el.open, el.close));
        const bot = Math.max(el.low, Math.max(el.open, el.close));
        return this.pointRectDist(x, y,
          el.x - el.width / 2 - 4, top - 4,
          el.width + 8, bot - top + 8);
      }
      case 'line': case 'arrow':
        return this.pointSegDist(x, y, el.x1, el.y1, el.x2, el.y2);
      case 'rect': {
        const rx = Math.min(el.x, el.x + el.w);
        const ry = Math.min(el.y, el.y + el.h);
        const rw = Math.abs(el.w);
        const rh = Math.abs(el.h);
        return this.pointRectDist(x, y, rx - 4, ry - 4, rw + 8, rh + 8);
      }
      case 'text': {
        const fs = el.fontSize || 14;
        const lh = fs * 1.3;
        const lines = (el.text || '').split('\n');
        const w = ChartRenderer.getTextWidth(el.text, fs);
        return this.pointRectDist(x, y, el.x - 4, el.y - 4, w + 8, lines.length * lh + 8);
      }
      case 'pencil': {
        const pts = el.points;
        if (!pts || pts.length < 2) return Infinity;
        let min = Infinity;
        for (let i = 1; i < pts.length; i++) {
          const d = this.pointSegDist(x, y, pts[i-1].x, pts[i-1].y, pts[i].x, pts[i].y);
          if (d < min) min = d;
        }
        return min;
      }
      case 'position': {
        const lineLen = 120;
        const top = Math.min(el.y, el.tpY, el.slY);
        const bot = Math.max(el.y, el.tpY, el.slY);
        const pad = 12;
        return this.pointRectDist(x, y, el.x - pad, top - pad, lineLen + pad * 2, bot - top + pad * 2);
      }
      default: return Infinity;
    }
  },

  pointSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  },

  pointRectDist(px, py, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(px, rx + rw));
    const ny = Math.max(ry, Math.min(py, ry + rh));
    return Math.hypot(px - nx, py - ny);
  },
};
