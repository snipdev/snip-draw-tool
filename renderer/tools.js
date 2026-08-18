function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
    pencilPoints: [],
  },
  resizeState: {
    active: false,
    elIndex: -1,
    candleIndex: -1,
    handleType: null,
  },

  init(app) {
    this.app = app;
  },

  getMouseWorld(e) {
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return {
      screenX,
      screenY,
      worldX: screenX - this.app.panX,
      worldY: screenY - this.app.panY,
    };
  },

  onMouseDown(e) {
    const app = this.app;
    const { screenX, screenY, worldX, worldY } = this.getMouseWorld(e);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.state.isPanning = true;
      this.state.panStartX = screenX - app.panX;
      this.state.panStartY = screenY - app.panY;
      return;
    }

    if (e.button !== 0) return;

    const tool = app.currentTool;

    if (tool === 'eraser') {
      const idx = this.findNearest(worldX, worldY);
      if (idx !== -1) {
        app.elements.splice(idx, 1);
        app.history.push(app.elements.map(el => ({ ...el })));
        app.render();
      }
      return;
    }

    if (tool === 'pointer') {
      const idx = this.findNearest(worldX, worldY);
      if (idx !== -1) {
        app.selectedIds.clear();
        app.selectedIds.add(app.elements[idx].id);
        const el = app.elements[idx];
        if (el.type === 'candle') {
          const handle = this.findHandle(worldX, worldY, el);
          if (handle) {
            this.resizeState.active = true;
            this.resizeState.elIndex = idx;
            this.resizeState.candleIndex = -1;
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
            this.resizeState.candleIndex = -1;
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
            this.resizeState.candleIndex = -1;
            this.resizeState.handleType = 'bottomRight';
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
            this.resizeState.candleIndex = -1;
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
      } else {
        app.selectedIds.clear();
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
      const slOffset = 30;
      const tpOffset = 30;
      const el = {
        id: app.uid(),
        type: 'position',
        direction: tool,
        x: worldX,
        y: worldY,
        slY: worldY + (isLong ? slOffset : -slOffset),
        tpY: worldY - (isLong ? tpOffset : -tpOffset),
        color: app.currentColor,
      };
      app.elements.push(el);
      app.selectedIds.clear();
      app.selectedIds.add(el.id);
      app.history.push(app.elements.map(e => ({ ...e })));
      app.render();
      app.setTool('pointer');
      return;
    }

    if (tool === 'pencil') {
      this.state.pencilPoints = [{ x: worldX, y: worldY }];
      this.state.preview = {
        type: 'pencil',
        points: [{ x: worldX, y: worldY }],
        color: app.currentColor,
        width: 2.5,
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

  onMouseMove(e) {
    const app = this.app;
    const { screenX, screenY, worldX, worldY } = this.getMouseWorld(e);

    if (this.state.isPanning) {
      app.panX = screenX - this.state.panStartX;
      app.panY = screenY - this.state.panStartY;
      app.render();
      return;
    }

    if (this.resizeState.active) {
      const el = app.elements[this.resizeState.elIndex];
      if (el && el.type === 'text' && this.resizeState.handleType === 'fontSize') {
        const newSize = Math.max(8, Math.round((worldY - el.y) / 1.3));
        el.fontSize = newSize;
        this.state.pointerMoved = true;
        app.render();
      } else if (el && el.type === 'rect' && this.resizeState.handleType === 'bottomRight') {
        const left = Math.min(el.x, el.x + el.w);
        const top = Math.min(el.y, el.y + el.h);
        const newW = Math.max(10, worldX - left);
        const newH = Math.max(10, worldY - top);
        el.x = left;
        el.y = top;
        el.w = newW;
        el.h = newH;
        this.state.pointerMoved = true;
        app.render();
      } else if (el && el.type === 'position') {
        switch (this.resizeState.handleType) {
          case 'sl':
            el.slY = worldY;
            break;
          case 'tp':
            el.tpY = worldY;
            break;
          case 'entry':
            el.y = worldY;
            break;
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
            if (newW > 6) { el.width = newW; el.x = worldX + newW / 2; }
            break;
          }
          case 'right': {
            const leftEdge = el.x - el.width / 2;
            const newW = worldX - leftEdge;
            if (newW > 6) { el.width = newW; el.x = leftEdge + newW / 2; }
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
          color: app.currentColor, width: 2,
        };
        break;
      case 'arrow':
        this.state.preview = {
          type: 'arrow', x1: sx, y1: sy, x2: worldX, y2: worldY,
          color: app.currentColor, width: 2.5,
        };
        break;
      case 'rect':
        this.state.preview = {
          type: 'rect', x: sx, y: sy, w: worldX - sx, h: worldY - sy,
          color: app.currentColor, fill: true,
          fillColor: hexToRGBA(app.currentColor, 0.12),
        };
        break;
      case 'pencil':
        this.state.pencilPoints.push({ x: worldX, y: worldY });
        this.state.preview = {
          type: 'pencil',
          points: [...this.state.pencilPoints],
          color: app.currentColor,
          width: 2.5,
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

    if (this.resizeState.active) {
      this.resizeState.active = false;
      this.resizeState.elIndex = -1;
      this.resizeState.candleIndex = -1;
      this.resizeState.handleType = null;
      if (this.state.pointerMoved) {
        app.history.push(app.elements.map(el => ({ ...el })));
      }
      this.state.pointerMoved = false;
      app.render();
      return;
    }

    if (app.currentTool === 'pointer' && this.state.dragElIndex >= 0) {
      this.state.active = false;
      if (this.state.pointerMoved) {
        app.history.push(app.elements.map(el => ({ ...el })));
      }
      this.state.dragElIndex = -1;
      return;
    }

    if (!this.state.active) return;

    this.state.active = false;

    if (this.state.preview) {
      const el = { ...this.state.preview, id: app.uid() };
      app.elements.push(el);
      if (el.type !== 'candle') {
        app.selectedIds.clear();
        app.selectedIds.add(el.id);
      }
      app.history.push(app.elements.map(el => ({ ...el })));
      this.state.preview = null;
      app.render();
      if (el.type !== 'candle') {
        app.setTool('pointer');
      }
    }
  },

  findNearest(x, y) {
    const app = this.app;
    let minDist = 20;
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
    const threshold = 4;
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
    return d < 6 ? 'fontSize' : null;
  },

  findRectHandle(x, y, el) {
    const handles = ChartRenderer.getRectHandles(el);
    const threshold = 6;
    for (const h of handles) {
      const d = Math.hypot(x - h.cx, y - h.cy);
      if (d < threshold) return h.type;
    }
    return null;
  },

  findPositionHandle(x, y, el) {
    const handles = ChartRenderer.getPositionHandles(el);
    const threshold = 8;
    for (const h of handles) {
      const d = Math.hypot(x - h.cx, y - h.cy);
      if (d < threshold) return h.type;
    }
    return null;
  },

  findPatternCandleAt(x, y, pattern) {
    let nearest = -1;
    let minDist = 20;
    for (let i = 0; i < pattern.candles.length; i++) {
      const absCandle = ChartRenderer.getPatternCandleAbs(pattern, i);
      const top = Math.min(absCandle.high, absCandle.open, absCandle.close);
      const bot = Math.max(absCandle.low, absCandle.open, absCandle.close);
      const d = this.pointRectDist(x, y,
        absCandle.x - absCandle.width / 2 - 4, top - 4,
        absCandle.width + 8, bot - top + 8);
      if (d < minDist) { minDist = d; nearest = i; }
    }
    return nearest;
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
        return Math.min(this.pointRectDist(x, y, rx - 4, ry - 4, rw + 8, rh + 8), 10);
      }
      case 'text': {
        const fs = el.fontSize || 14;
        const lh = fs * 1.3;
        const lines = (el.text || '').split('\n');
        return this.pointRectDist(x, y, el.x - 4, el.y - 4, 200, lines.length * lh + 8);
      }
      case 'pattern': {
        let min = Infinity;
        for (const c of el.candles) {
          const cx = el.x + c.dx;
          const top = el.y + Math.min(c.open, c.close, c.high);
          const bot = el.y + Math.max(c.open, c.close, c.low);
          const w = c.width || 14;
          const d = this.pointRectDist(x, y, cx - w / 2 - 3, top - 3, w + 6, bot - top + 6);
          if (d < min) min = d;
        }
        return min;
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
