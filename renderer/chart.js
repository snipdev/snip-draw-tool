const ChartRenderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  dpr: 1,

  gridSpacingX: 50,
  gridSpacingY: 50,
  gridLineColor: '#2a2a4a',
  axisColor: '#4a4a6a',
  selectionColor: '#818cf8',
  defaultTextColor: '#e2e8f0',

  setTheme(theme) {
    if (theme === 'light') {
      this.gridLineColor = '#e2e8f0';
      this.axisColor = '#cbd5e1';
      this.selectionColor = '#4f46e5';
      this.defaultTextColor = '#1e293b';
    } else {
      this.gridLineColor = '#2a2a4a';
      this.axisColor = '#4a4a6a';
      this.selectionColor = '#818cf8';
      this.defaultTextColor = '#e2e8f0';
    }
  },

  patternColors: {
    bullish: '#22c55e',
    bearish: '#ef4444',
  },

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  },

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  render(elements, hoveredElement, selectedIds, panX, panY, zoom) {
    this.renderTo(this.ctx, this.width, this.height, elements, hoveredElement, selectedIds, panX, panY, zoom);
  },

  renderTo(ctx, width, height, elements, hoveredElement, selectedIds, panX, panY, zoom) {
    this.drawGrid(ctx, width, height, panX, panY, zoom);

    for (const el of elements) {
      if (el === hoveredElement) continue;
      this.drawElement(ctx, el, selectedIds && selectedIds.has(el.id));
    }

    if (hoveredElement) {
      const isHovSelected = selectedIds && selectedIds.has(hoveredElement.id);
      this.drawElement(ctx, hoveredElement, isHovSelected, true);
    }
  },

  drawGrid(ctx, width, height, panX = 0, panY = 0, zoom = 1) {
    const z = zoom || 1;
    const target = 50;
    let interval = this.gridSpacingX;
    while (interval * z > target * 1.5) interval /= 2;
    while (interval * z < target * 0.75) interval *= 2;

    const worldLeft = -panX / z;
    const worldTop = -panY / z;
    const worldRight = (width - panX) / z;
    const worldBottom = (height - panY) / z;

    ctx.strokeStyle = this.gridLineColor;
    ctx.lineWidth = 0.5 / z;

    ctx.beginPath();
    for (let x = Math.floor(worldLeft / interval) * interval; x <= worldRight; x += interval) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }
    for (let y = Math.floor(worldTop / interval) * interval; y <= worldBottom; y += interval) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();
  },

  drawElement(ctx, el, isSelected, isHovered) {
    if (!el) return;
    switch (el.type) {
      case 'candle': this.drawCandle(ctx, el, isSelected, isHovered); break;
      case 'line': this.drawLine(ctx, el, isSelected, isHovered); break;
      case 'arrow': this.drawArrow(ctx, el, isSelected, isHovered); break;
      case 'rect': this.drawRectangle(ctx, el, isSelected, isHovered); break;
      case 'text': this.drawText(ctx, el, isSelected, isHovered); break;
      case 'pencil': this.drawPencil(ctx, el, isSelected, isHovered); break;
      case 'position': this.drawPosition(ctx, el, isSelected, isHovered); break;
    }
  },

  drawCandle(ctx, c, isSelected, isHovered) {
    const bodyTop = Math.min(c.open, c.close);
    const bodyBot = Math.max(c.open, c.close);
    const isUp = c.close < c.open;
    const color = isUp ? this.patternColors.bullish : this.patternColors.bearish;

    ctx.save();

    if (isHovered) {
      ctx.shadowColor = 'rgba(255,255,255,0.2)';
      ctx.shadowBlur = 8;
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(c.x, c.high);
    ctx.lineTo(c.x, bodyTop);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(c.x, bodyBot);
    ctx.lineTo(c.x, c.low);
    ctx.stroke();

    ctx.fillRect(c.x - c.width / 2, bodyTop, c.width, Math.max(1, bodyBot - bodyTop));

    ctx.strokeStyle = isUp ? '#16a34a' : '#dc2626';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(c.x - c.width / 2, bodyTop, c.width, Math.max(1, bodyBot - bodyTop));

    if (isSelected || isHovered) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = this.selectionColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      const pad = 4;
      ctx.strokeRect(
        c.x - c.width / 2 - pad,
        Math.min(c.high, bodyTop) - pad,
        c.width + pad * 2,
        Math.max(c.low, bodyBot) - Math.min(c.high, bodyTop) + pad * 2
      );
      ctx.setLineDash([]);
    }

    if (isSelected) {
      this.drawCandleHandles(ctx, c, bodyTop, bodyBot);
    }

    ctx.restore();
  },

  drawLine(ctx, l, isSelected, isHovered) {
    ctx.save();
    ctx.strokeStyle = isHovered ? '#a78bfa' : (l.color || '#60a5fa');
    ctx.lineWidth = isHovered ? (l.width || 2) + 1 : (l.width || 2);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();

    if (isSelected || isHovered) {
      ctx.strokeStyle = this.selectionColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(
        Math.min(l.x1, l.x2) - 4,
        Math.min(l.y1, l.y2) - 4,
        Math.abs(l.x2 - l.x1) + 8,
        Math.abs(l.y2 - l.y1) + 8
      );
      ctx.setLineDash([]);
    }

    if (isSelected) {
      this.drawLineHandles(ctx, l);
    }
    ctx.restore();
  },

  drawArrow(ctx, a, isSelected, isHovered) {
    ctx.save();
    const color = isHovered ? '#a78bfa' : (a.color || '#60a5fa');
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = isHovered ? (a.width || 2.5) + 1 : (a.width || 2.5);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();

    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const headLen = 14;
    ctx.beginPath();
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(
      a.x2 - headLen * Math.cos(angle - Math.PI / 7),
      a.y2 - headLen * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      a.x2 - headLen * Math.cos(angle + Math.PI / 7),
      a.y2 - headLen * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();

    if (isSelected || isHovered) {
      ctx.strokeStyle = this.selectionColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(
        Math.min(a.x1, a.x2) - 5,
        Math.min(a.y1, a.y2) - 5,
        Math.abs(a.x2 - a.x1) + 10,
        Math.abs(a.y2 - a.y1) + 10
      );
      ctx.setLineDash([]);
    }

    if (isSelected) {
      this.drawLineHandles(ctx, a);
    }
    ctx.restore();
  },

  drawRectangle(ctx, r, isSelected, isHovered) {
    ctx.save();
    const color = isHovered ? '#a78bfa' : (r.color || '#f59e0b');
    const x = Math.min(r.x, r.x + r.w);
    const y = Math.min(r.y, r.y + r.h);
    const w = Math.abs(r.w);
    const h = Math.abs(r.h);

    ctx.strokeStyle = color;
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(x, y, w, h);

    if (r.fill) {
      ctx.fillStyle = r.fillColor || 'rgba(245, 158, 11, 0.08)';
      ctx.fillRect(x, y, w, h);
    }

    if (isSelected || isHovered) {
      ctx.strokeStyle = this.selectionColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
      ctx.setLineDash([]);
    }

    if (isSelected) {
      this.drawRectHandles(ctx, r);
    }
    ctx.restore();
  },

  drawText(ctx, t, isSelected, isHovered) {
    ctx.save();
    const color = isHovered ? '#a78bfa' : (t.color || this.defaultTextColor);
    ctx.fillStyle = color;
    ctx.font = `${t.fontSize || 14}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = (t.text || '').split('\n');
    const lineH = (t.fontSize || 14) * 1.3;
    let maxW = 0;

    lines.forEach((line, i) => {
      ctx.fillText(line, t.x, t.y + i * lineH);
      const m = ctx.measureText(line);
      if (m.width > maxW) maxW = m.width;
    });

    if (isSelected || isHovered) {
      ctx.strokeStyle = this.selectionColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      const totalH = lines.length * lineH;
      ctx.strokeRect(t.x - 3, t.y - 3, maxW + 6, totalH + 6);
      ctx.setLineDash([]);
    }

    if (isSelected) {
      this.drawTextHandles(ctx, t);
    }
    ctx.restore();
  },

  drawPencil(ctx, el, isSelected, isHovered) {
    const pts = el.points;
    if (!pts || pts.length < 2) return;
    ctx.save();
    const color = isHovered ? '#a78bfa' : (el.color || '#60a5fa');
    ctx.strokeStyle = color;
    ctx.lineWidth = isHovered ? (el.width || 2.5) + 1 : (el.width || 2.5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    if (isSelected || isHovered) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      ctx.strokeStyle = this.selectionColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
      ctx.setLineDash([]);
    }
    ctx.restore();
  },

  drawPosition(ctx, el, isSelected, isHovered) {
    ctx.save();
    const isLong = el.direction === 'long';
    const baseColor = isHovered ? '#a78bfa' : this.defaultTextColor;
    const lineLen = 120;
    const arrowSize = 14;
    const connectorX = el.x + lineLen;

    const tpColor = '#22c55e';
    const slColor = '#ef4444';

    const unitPx = 50;
    const dirSign = el.direction === 'long' ? -1 : 1;
    const unitLabel = (y) => {
      const u = ((y - el.y) * dirSign) / unitPx;
      const r = Math.round(u * 10) / 10;
      const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
      return (r > 0 ? '+' : '') + s + 'u';
    };

    // --- vertical connectors (dotted) ---
    ctx.strokeStyle = '#4a4a6a';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(connectorX, el.y);
    ctx.lineTo(connectorX, el.tpY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(connectorX, el.y);
    ctx.lineTo(connectorX, el.slY);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- TP line ---
    ctx.strokeStyle = isHovered ? '#a78bfa' : tpColor;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(el.x, el.tpY);
    ctx.lineTo(el.x + lineLen, el.tpY);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- SL line ---
    ctx.strokeStyle = isHovered ? '#a78bfa' : slColor;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(el.x, el.slY);
    ctx.lineTo(el.x + lineLen, el.slY);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Entry line ---
    ctx.strokeStyle = baseColor;
    ctx.fillStyle = baseColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(el.x, el.y);
    ctx.lineTo(el.x + lineLen, el.y);
    ctx.stroke();

    // --- Direction arrow ---
    const dir = isLong ? 1 : -1;
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(el.x, el.y - dir * arrowSize);
    ctx.lineTo(el.x + arrowSize * 0.7, el.y + dir * arrowSize * 0.3);
    ctx.lineTo(el.x - arrowSize * 0.7, el.y + dir * arrowSize * 0.3);
    ctx.closePath();
    ctx.fill();

    // --- Labels ---
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const labelX = el.x + lineLen + 8;

    ctx.fillStyle = baseColor;
    ctx.fillText(isLong ? 'Long' : 'Short', labelX, el.y);

    ctx.fillStyle = tpColor;
    ctx.fillText('TP ' + unitLabel(el.tpY), labelX, el.tpY);

    ctx.fillStyle = slColor;
    ctx.fillText('SL ' + unitLabel(el.slY), labelX, el.slY);

    // --- Handle dots (only when selected) ---
    if (isSelected) {
      const handleR = 4;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      this.drawHandleDot(ctx, connectorX, el.y, handleR);
      this.drawHandleDot(ctx, connectorX, el.slY, handleR);
      this.drawHandleDot(ctx, connectorX, el.tpY, handleR);
    }

    ctx.restore();
  },

  drawHandleDot(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },

  getPositionHandles(el) {
    const lineLen = 120;
    const connectorX = el.x + lineLen;
    const hs = 5;
    return [
      { type: 'entry', cx: connectorX, cy: el.y, hs },
      { type: 'sl', cx: connectorX, cy: el.slY, hs },
      { type: 'tp', cx: connectorX, cy: el.tpY, hs },
    ];
  },

  getCandleHandles(c) {
    const bodyTop = Math.min(c.open, c.close);
    const bodyBot = Math.max(c.open, c.close);
    const hs = 3;
    return [
      { type: 'high',    x: c.x, y: c.high,              cx: c.x, cy: c.high,            hs: hs },
      { type: 'low',     x: c.x, y: c.low,               cx: c.x, cy: c.low,             hs: hs },
      { type: 'bodyTop', x: c.x, y: bodyTop,              cx: c.x, cy: bodyTop,           hs: hs },
      { type: 'bodyBot', x: c.x, y: bodyBot,              cx: c.x, cy: bodyBot,           hs: hs },
      { type: 'left',    x: c.x - c.width / 2, y: (bodyTop + bodyBot) / 2, cx: c.x - c.width / 2, cy: (bodyTop + bodyBot) / 2, hs: hs },
      { type: 'right',   x: c.x + c.width / 2, y: (bodyTop + bodyBot) / 2, cx: c.x + c.width / 2, cy: (bodyTop + bodyBot) / 2, hs: hs },
    ];
  },

  getRectHandles(r) {
    const x = Math.min(r.x, r.x + r.w);
    const y = Math.min(r.y, r.y + r.h);
    const w = Math.abs(r.w);
    const h = Math.abs(r.h);
    const hs = 4;
    return [
      { type: 'nw', cx: x, cy: y, hs: hs },
      { type: 'ne', cx: x + w, cy: y, hs: hs },
      { type: 'sw', cx: x, cy: y + h, hs: hs },
      { type: 'se', cx: x + w, cy: y + h, hs: hs },
    ];
  },

  getLineHandles(l) {
    const hs = 4;
    return [
      { type: 'start', cx: l.x1, cy: l.y1, hs: hs },
      { type: 'end', cx: l.x2, cy: l.y2, hs: hs },
    ];
  },

  drawLineHandles(ctx, l) {
    const handles = this.getLineHandles(l);
    ctx.fillStyle = this.selectionColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (const h of handles) {
      ctx.fillRect(h.cx - h.hs, h.cy - h.hs, h.hs * 2, h.hs * 2);
      ctx.strokeRect(h.cx - h.hs, h.cy - h.hs, h.hs * 2, h.hs * 2);
    }
  },

  drawRectHandles(ctx, r) {
    const handles = this.getRectHandles(r);
    ctx.fillStyle = this.selectionColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (const h of handles) {
      ctx.fillRect(h.cx - h.hs, h.cy - h.hs, h.hs * 2, h.hs * 2);
      ctx.strokeRect(h.cx - h.hs, h.cy - h.hs, h.hs * 2, h.hs * 2);
    }
  },

  drawCandleHandles(ctx, c, bodyTop, bodyBot) {
    const handles = this.getCandleHandles(c);
    ctx.fillStyle = this.selectionColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (const h of handles) {
      ctx.fillRect(h.cx - h.hs, h.cy - h.hs, h.hs * 2, h.hs * 2);
      ctx.strokeRect(h.cx - h.hs, h.cy - h.hs, h.hs * 2, h.hs * 2);
    }
  },

  getTextHandle(t, ctx) {
    ctx.save();
    ctx.font = `${t.fontSize || 14}px system-ui, -apple-system, sans-serif`;
    const lines = (t.text || '').split('\n');
    const lineH = (t.fontSize || 14) * 1.3;
    let maxW = 0;
    lines.forEach(line => {
      const m = ctx.measureText(line);
      if (m.width > maxW) maxW = m.width;
    });
    ctx.restore();
    const hs = 4;
    return { type: 'fontSize', cx: t.x + maxW + 2, cy: t.y + lines.length * lineH, hs: hs };
  },

  drawTextHandles(ctx, t) {
    const h = this.getTextHandle(t, ctx);
    ctx.fillStyle = this.selectionColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.fillRect(h.cx - h.hs, h.cy - h.hs, h.hs * 2, h.hs * 2);
    ctx.strokeRect(h.cx - h.hs, h.cy - h.hs, h.hs * 2, h.hs * 2);
  },

  getBounds(el) {
    switch (el.type) {
      case 'candle': {
        const top = Math.min(el.high, Math.min(el.open, el.close));
        const bot = Math.max(el.low, Math.max(el.open, el.close));
        return { x: el.x - el.width / 2, y: top, w: el.width, h: bot - top };
      }
      case 'line': case 'arrow':
        return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
      case 'rect': {
        const x = Math.min(el.x, el.x + el.w);
        const y = Math.min(el.y, el.y + el.h);
        return { x, y, w: Math.abs(el.w), h: Math.abs(el.h) };
      }
      case 'text': {
        const fs = el.fontSize || 14;
        const lines = (el.text || '').split('\n');
        const maxW = this.getTextWidth(el.text, fs);
        return { x: el.x, y: el.y, w: maxW, h: lines.length * fs * 1.3 };
      }
      case 'pencil': {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of el.points) {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
      case 'position': {
        const lineLen = 120;
        const top = Math.min(el.y, el.tpY, el.slY);
        const bot = Math.max(el.y, el.tpY, el.slY);
        return { x: el.x, y: top, w: lineLen, h: bot - top };
      }
      default: return { x: el.x, y: el.y, w: 0, h: 0 };
    }
  },

  getTextWidth(text, fs) {
    if (!this.ctx) return 0;
    this.ctx.save();
    this.ctx.font = `${fs}px system-ui, -apple-system, sans-serif`;
    let maxW = 0;
    for (const line of String(text || '').split('\n')) {
      const m = this.ctx.measureText(line);
      if (m.width > maxW) maxW = m.width;
    }
    this.ctx.restore();
    return maxW;
  },

  drawEraserPreview(ctx, el) {
    const b = this.getBounds(el);
    ctx.save();
    ctx.globalAlpha = 0.35;
    this.drawElement(ctx, el, false, false);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.setLineDash([]);
    ctx.restore();
  },
};
