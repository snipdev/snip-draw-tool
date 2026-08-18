const ChartRenderer = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,

  gridSpacingX: 50,
  gridSpacingY: 50,
  gridColor: '#1e1e3a',
  gridLineColor: '#2a2a4a',
  axisColor: '#4a4a6a',
  labelColor: '#5a5a7a',
  selectionColor: '#818cf8',
  defaultTextColor: '#e2e8f0',

  setTheme(theme) {
    if (theme === 'light') {
      this.gridLineColor = '#e2e8f0';
      this.axisColor = '#cbd5e1';
      this.labelColor = '#475569';
      this.selectionColor = '#4f46e5';
      this.defaultTextColor = '#1e293b';
    } else {
      this.gridLineColor = '#2a2a4a';
      this.axisColor = '#4a4a6a';
      this.labelColor = '#a0a0c0';
      this.selectionColor = '#818cf8';
      this.defaultTextColor = '#e2e8f0';
    }
  },

  patternColors: {
    bullish: '#22c55e',
    bearish: '#ef4444',
  },

  getPatternCandleAbs(pattern, candleIndex) {
    const c = pattern.candles[candleIndex];
    return {
      x: pattern.x + c.dx,
      open: pattern.y + c.open,
      close: pattern.y + c.close,
      high: pattern.y + c.high,
      low: pattern.y + c.low,
      width: c.width || 14,
    };
  },

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  },

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = this.canvas.width = rect.width;
    this.height = this.canvas.height = rect.height;
  },

  render(elements, hoveredElement, selectedIds, placingPattern) {
    this.drawGrid(this.ctx);

    for (const el of elements) {
      if (el === hoveredElement) continue;
      this.drawElement(this.ctx, el, selectedIds && selectedIds.has(el.id));
    }

    if (hoveredElement) {
      const isHovSelected = selectedIds && selectedIds.has(hoveredElement.id);
      this.drawElement(this.ctx, hoveredElement, isHovSelected, true);
    }

    if (placingPattern) {
      this.drawPatternPreview(this.ctx, placingPattern);
    }
  },

  drawGrid(ctx) {
    ctx.strokeStyle = this.gridLineColor;
    ctx.lineWidth = 0.5;

    const gx = this.gridSpacingX;
    const gy = this.gridSpacingY;

    for (let x = gx; x < this.width; x += gx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    for (let y = gy; y < this.height; y += gy) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    const labelIntervalX = Math.max(1, Math.floor(gx / 10));
    const labelIntervalY = Math.max(1, Math.floor(gy / 10));

    ctx.fillStyle = this.labelColor;
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let barNum = 1;
    for (let x = gx; x < this.width; x += gx) {
      ctx.fillText(barNum.toString(), x, 2);
      barNum++;
      if (barNum > 100) break;
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    let price = 1.0500;
    for (let y = gy; y < this.height; y += gy) {
      ctx.fillText(price.toFixed(4), 40, y);
      price += 0.0010;
      if (price > 2) break;
    }
  },

  drawElement(ctx, el, isSelected, isHovered) {
    if (!el) return;
    switch (el.type) {
      case 'candle': this.drawCandle(ctx, el, isSelected, isHovered); break;
      case 'line': this.drawLine(ctx, el, isSelected, isHovered); break;
      case 'arrow': this.drawArrow(ctx, el, isSelected, isHovered); break;
      case 'rect': this.drawRectangle(ctx, el, isSelected, isHovered); break;
      case 'text': this.drawText(ctx, el, isSelected, isHovered); break;
      case 'pattern': this.drawPattern(ctx, el, isSelected, isHovered); break;
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

  drawPattern(ctx, p, isSelected, isHovered) {
    ctx.save();
    for (let i = 0; i < p.candles.length; i++) {
      const absCandle = this.getPatternCandleAbs(p, i);
      this.drawCandle(ctx, absCandle, false, false);
    }

    if (isSelected || isHovered) {
      let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
      for (const c of p.candles) {
        const cx = p.x + c.dx;
        const cy = p.y;
        const top = cy + Math.min(c.open, c.close, c.high);
        const bot = cy + Math.max(c.open, c.close, c.low);
        if (cx - (c.width || 14) / 2 < minX) minX = cx - (c.width || 14) / 2;
        if (cx + (c.width || 14) / 2 > maxX) maxX = cx + (c.width || 14) / 2;
        if (top < minY) minY = top;
        if (bot > maxY) maxY = bot;
      }
      ctx.strokeStyle = this.selectionColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
      ctx.setLineDash([]);
    }
    ctx.restore();
  },

  drawPatternPreview(ctx, p) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    for (const c of p.candles) {
      this.drawCandle(ctx, {
        x: p.x + c.dx,
        open: p.y + c.open,
        close: p.y + c.close,
        high: p.y + c.high,
        low: p.y + c.low,
        width: c.width || 14,
      }, false, true);
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

    const formatPrice = (y) => {
      const price = 1.0500 + (y / 50) * 0.001;
      return price.toFixed(4);
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
    ctx.fillText('TP ' + formatPrice(el.tpY), labelX, el.tpY);

    ctx.fillStyle = slColor;
    ctx.fillText('SL ' + formatPrice(el.slY), labelX, el.slY);

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
      { type: 'bottomRight', cx: x + w, cy: y + h, hs: hs },
    ];
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
};
