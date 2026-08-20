# Yapılacaklar

UX/UI incelemesinden (2026-08-20) çıkan liste. Öncelik sırasına göre.

## Öncelik 1 (bug / kalite)

- [x] **Undo/redo taşıma & boyutlandırmada çalışmıyor** — `renderer/tools.js:367-387` snapshot değişiklikten SONRA alınıyor; undo font-size/mum/dikdörtgen değişikliğini geri getiremiyor. Snapshot mutasyondan ÖNCE alınmalı.
- [x] **Blurry çıktı / export** — `renderer/chart.js:55-59` devicePixelRatio yok; yüksek-DPI'da bulanık, PNG export piksel piksel. Canvas'a DPR ölçekleme ekle.
- [x] **Işık temasında renk seçici tutarsız** — `renderer/app.js:241` light mode'da currentColor `#1e293b` ama DOM'daki aktif swatch beyaz kalıyor. Swatch highlight = gerçek renk olmalı.
- [x] **Eraser imleci `not-allowed`** — `renderer/app.js:67`, `renderer/styles.css:162`; gerçek silgi imleci + hover'da silinecek öğenin önizlemesi.

## Öncelik 2 (UX)

- [x] **Pan keşfedilebilirliği** — orta tuş/Alt+drag (`renderer/tools.js:50`) ipucu yok; boş alana sürükle = pan + Space+drag.
- [x] **Fiyat/bardak etiketleri yanıltıcı** — `renderer/chart.js:108-123` sabit değerler pan'ı takip etmiyor; ya pan ile taşınsın ya kaldırılsın.
- [x] **Zoom** — sabit 50px grid; Ctrl+wheel zoom ekle.
- [x] **Seçim & düzenleme tutarlılığı** — shift-çoğul/marquee seçim; line/arrow uç nokta handle'ları; rect çoklu handle.
- [x] **Clear All onayı** — `renderer/app.js:221` doğrulama ekle; undo/redo butonları disabled durumu.
- [x] **Long/Short sürükle-çiz** — tek tık sabit ±30px (`renderer/tools.js:147-149`) yerine sürükleyerek SL/TP.
- [x] **Ctrl+S = export**, kalınlık ayarı.

## Öncelik 3 (UI / iyileştirme)

- [x] Renk seçiciye `<input type="color">` custom picker; kalınlık ayarı.
- [x] Toolbar'da seçili aracın adını gösteren status readout.
- [x] Export dosya adına tarih/istenen ad (`renderer/app.js:231`).

## Dead code / teknik

- [x] `renderer/tools.js:26,83` `resizeState.candleIndex` kullanılmıyor.
- [x] `renderer/chart.js:100-101` `labelIntervalX/Y` hesaplanıp atılıyor.
- [x] `renderer/chart.js` `gridColor` kullanılmıyor.