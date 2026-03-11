// ══════════════════════════════════════════════════════════════
//  POSDZ_PRINT — وحدة الطباعة المستقلة — v7.0.0
//  مسؤولة حصرياً عن طباعة ملصقات الباركود
//  الفاتورة تظل في app.js بدون تعديل
// ══════════════════════════════════════════════════════════════

const POSDZ_PRINT = (() => {

  // ── أبعاد الملصقات (مم) — العرض × الارتفاع بدون قلب ──────────────
  const SIZE_MAP = {
    '58x38': { w: 58, h: 38 },
    '58x30': { w: 58, h: 30 },
    '58x20': { w: 58, h: 20 },
    '40x30': { w: 40, h: 30 },
    '40x25': { w: 40, h: 25 },
    '40x20': { w: 40, h: 20 },  // ← Xprinter 420B الأساسي
    '38x25': { w: 38, h: 25 },
    '30x20': { w: 30, h: 20 },
  };

  // ── بناء الباركود — direction:ltr إجباري لمنع العكس في RTL ───────
  function _buildBars(code, hMM) {
    const s   = String(code);
    const HPX = Math.max(20, Math.round(hMM * 3.7795)); // مم → px عند 96dpi
    const N   = 1.5; // عرض شريط رفيع
    const W   = 3.0; // عرض شريط سميك

    let inner = '';
    // حارسة بداية
    inner += `<i style="width:2px;height:${HPX}px;background:#000;"></i>`;
    inner += `<i style="width:2px;height:${HPX}px;background:#fff;"></i>`;

    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      for (let j = 0; j < 5; j++) {
        const black = j % 2 === 0;
        const bit   = (c >> (4 - j)) & 1;
        const w     = bit ? W : N;
        inner += `<i style="width:${w}px;height:${HPX}px;background:${black?'#000':'#fff'};"></i>`;
      }
      inner += `<i style="width:2px;height:${HPX}px;background:#fff;"></i>`;
    }

    // حارسة نهاية
    inner += `<i style="width:2px;height:${HPX}px;background:#000;"></i>`;

    // الحاوية: direction:ltr صارم — white-space:nowrap — inline-flex
    return `<div style="direction:ltr;display:flex;align-items:flex-end;justify-content:center;white-space:nowrap;overflow:hidden;width:100%;line-height:0;">${inner}</div>`;
  }

  // ── طباعة ملصق باركود ─────────────────────────────────────────────
  async function barcode(product) {
    if (!product) return;

    const bv = (product.barcode || String(product.id || '')).trim();
    if (!bv) { if (typeof toast === 'function') toast('لا يوجد رقم باركود للمنتج', 'warning'); return; }

    // جلب كل الإعدادات دفعة واحدة
    const [sName, cur, bcFont, bcType, showStore, showName, showPrice, rawSize, rawFs] = await Promise.all(
      ['storeName','currency','barcodeFont','barcodeType',
       'barcodeShowStore','barcodeShowName','barcodeShowPrice',
       'barcodeLabelSize','barcodeFontSize'].map(k => getSetting(k))
    );

    // أبعاد الملصق الصحيحة — بدون قلب
    const size = SIZE_MAP[rawSize || '58x38'] || SIZE_MAP['58x38'];
    const W = size.w; // عرض (مم)
    const H = size.h; // ارتفاع (مم)

    // أحجام الخطوط
    const fs       = Math.max(6,  Math.min(24, parseInt(rawFs) || 12));
    const fsStore  = Math.max(5,  fs - 3);
    const fsBc     = Math.max(4,  fs - 4);
    const fsPrice  = Math.max(7,  fs + 2);

    // حساب ارتفاع أشرطة الباركود بدقة
    // كل سطر نص ≈ حجم_الخط(px) × 0.35 مم + 0.8 مم هامش
    let takenMM = 2.0; // padding عام 1mm × 2
    if (showStore === '1' && sName) takenMM += fsStore * 0.35 + 0.8;
    if (showName  !== '0')          takenMM += fs      * 0.35 + 0.8;
    takenMM += fsBc * 0.35 + 0.8;  // رقم الباركود دائماً موجود
    if (showPrice !== '0')          takenMM += fsPrice * 0.35 + 0.8;

    const barsH = Math.max(6, H - takenMM);

    // بناء الباركود أو QR
    const barsHTML = bcType === 'QR'
      ? `<div style="direction:ltr;font-family:monospace;font-size:${fsBc}px;border:1.5px solid #000;padding:1px 2px;display:inline-block;">[QR:${bv}]</div>`
      : _buildBars(bv, barsH);

    // تنسيق السعر
    const priceStr = (typeof formatDZ === 'function')
      ? formatDZ(product.sellPrice || 0)
      : `${parseFloat(product.sellPrice || 0).toFixed(0)} ${cur || 'DA'}`;

    // ── HTML الملصق ── @page بأبعاد دقيقة — html/body مقيّد بالحجم ──
    const labelHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    margin: 0;
    size: ${W}mm ${H}mm;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html {
    width: ${W}mm;
    height: ${H}mm;
    overflow: hidden;
  }
  body {
    width: ${W}mm;
    height: ${H}mm;
    overflow: hidden;
    background: #fff;
    color: #000;
    font-family: '${bcFont || 'Cairo'}', Arial, sans-serif;
    text-align: center;
    padding: 1mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    page-break-inside: avoid;
  }
  .sn {
    font-size: ${fsStore}px; font-weight: 800;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    width: 100%;
  }
  .pn {
    font-size: ${fs}px; font-weight: 900;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    width: 100%;
  }
  .bc {
    font-family: 'Courier New', monospace;
    font-size: ${fsBc}px; font-weight: 800;
    letter-spacing: 1px;
    direction: ltr;
  }
  .pr {
    font-size: ${fsPrice}px; font-weight: 900;
    direction: ltr;
  }
  @media print { * { color: #000 !important; } }
</style>
</head>
<body>
${showStore === '1' && sName ? `<div class="sn">${sName}</div>` : ''}
${showName  !== '0'          ? `<div class="pn">${product.name}${product.size ? ' — ' + product.size : ''}</div>` : ''}
${barsHTML}
<div class="bc">${bv}</div>
${showPrice !== '0'          ? `<div class="pr">${priceStr}</div>` : ''}
</body>
</html>`;

    // طباعة عبر السيرفر إن توفر — وإلا iframe صامت
    await _printBarcodeSmart(labelHTML, rawSize || '58x38');
  }

  // ── محرك الطباعة — يحاول السيرفر أولاً ثم iframe ────────────────
  async function _printBarcodeSmart(html, rawSize) {
    try {
      const syncEnabled = await getSetting('syncEnabled');
      const serverIP    = await getSetting('syncServerIP')   || '192.168.1.1';
      const serverPort  = await getSetting('syncServerPort') || '3000';
      if (syncEnabled === '1') {
        const printerName = await getSetting('printerBarcode') || '';
        const resp = await fetch(`http://${serverIP}:${serverPort}/api/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, printerName, labelSize: rawSize }),
          signal: AbortSignal.timeout(6000)
        });
        if (resp.ok) {
          const r = await resp.json();
          if (r.status === 'ok') {
            if (typeof toast === 'function') toast(`🖨️ جاري الطباعة على: ${r.printer}`, 'success');
            return;
          }
        }
      }
    } catch (_) { /* السيرفر غير متاح */ }

    // Fallback: iframe صامت
    _iframePrint(html);
  }

  // ── طباعة عبر iframe مخفي ────────────────────────────────────────
  function _iframePrint(html) {
    const old = document.getElementById('_posdzBcFrame');
    if (old) old.remove();

    const f = document.createElement('iframe');
    f.id = '_posdzBcFrame';
    f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;visibility:hidden;';
    document.body.appendChild(f);

    const doc = f.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    f.onload = () => {
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch (e) {
        // fallback: نافذة منفصلة إن فشل iframe
        const w = window.open('', '_blank', 'width=300,height=200');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.onload = () => { w.print(); w.onafterprint = () => w.close(); };
        }
      }
      setTimeout(() => { if (f.parentNode) f.remove(); }, 5000);
    };
  }

  // API العامة
  return { barcode, SIZE_MAP };

})();
