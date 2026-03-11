// ══════════════════════════════════════════════════════════════
//  POSDZ_PRINT — وحدة الطباعة — v8.0.0
//  ✅ باركود حقيقي عبر JsBarcode (Code128 / EAN13 / EAN8)
//  ✅ X-Dimension ديناميكي — Pixel Snapping حقيقي
//  ✅ ملصق يملأ الحجم تماماً بدون هدر
//  ✅ اختيار الطابعة من قائمة حقيقية عبر السيرفر
// ══════════════════════════════════════════════════════════════

const POSDZ_PRINT = (() => {

  // ── أبعاد الملصقات (مم) ─────────────────────────────────────
  const SIZE_MAP = {
    '58x38': { w: 58, h: 38 },
    '58x30': { w: 58, h: 30 },
    '58x20': { w: 58, h: 20 },
    '40x30': { w: 40, h: 30 },
    '40x25': { w: 40, h: 25 },
    '40x20': { w: 40, h: 20 },
    '38x25': { w: 38, h: 25 },
    '30x20': { w: 30, h: 20 },
  };

  // ── URL مكتبة JsBarcode (CDN — تعمل offline بعد أول تحميل) ──
  const JSBARCODE_CDN = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';

  // ── تحديد نوع الباركود تلقائياً بناءً على الرقم ────────────
  function _detectFormat(code) {
    const s = String(code).trim();
    if (/^\d{13}$/.test(s)) return 'EAN13';
    if (/^\d{8}$/.test(s))  return 'EAN8';
    if (/^\d{12}$/.test(s)) return 'UPC';
    return 'CODE128'; // الأشمل — يقبل حروف وأرقام
  }

  // ── حساب X-Dimension ديناميكي (Pixel Snapping حقيقي) ────────
  // يحدد عرض أضيق شريط بحيث يملأ الباركود العرض المتاح تماماً
  // بدون أشرطة جزئية أو هدر
  function _calcXDim(widthMM, code, format) {
    const s = String(code);
    // عدد وحدات Code128 تقريبياً: (طول + 3 حارسات + توقف) × 11 وحدة
    // EAN13: 95 وحدة ثابتة
    let units;
    if (format === 'EAN13') units = 95;
    else if (format === 'EAN8') units = 67;
    else if (format === 'UPC') units = 95;
    else units = (s.length + 3) * 11 + 35; // Code128 تقريبي

    // تحويل العرض المتاح من مم إلى px عند 96dpi، مع هامش أمان
    const availablePX = (widthMM - 2) * 3.7795;
    // X-Dimension = المساحة المتاحة ÷ عدد الوحدات
    const xDim = availablePX / units;
    // Pixel Snapping: تقريب لأقرب 0.5px لضمان أشرطة متناسقة
    return Math.max(0.8, Math.round(xDim * 2) / 2);
  }

  // ── بناء HTML باركود حقيقي عبر JsBarcode ────────────────────
  function _buildBarcodeHTML(code, widthMM, heightMM, format) {
    const fmt  = format || _detectFormat(code);
    const xDim = _calcXDim(widthMM, code, fmt);
    // ارتفاع الأشرطة بالبكسل
    const barH = Math.max(15, Math.round(heightMM * 3.7795));

    // SVG inline — JsBarcode يرسم عليه مباشرة
    // width=100% يجعله يتمدد ليملأ عرض الملصق تماماً
    return `
      <svg id="_bc_svg" style="width:100%;display:block;"></svg>
      <script>
        (function() {
          try {
            JsBarcode('#_bc_svg', ${JSON.stringify(String(code))}, {
              format:      ${JSON.stringify(fmt)},
              width:       ${xDim},
              height:      ${barH},
              displayValue: false,
              margin:      0,
              background:  '#ffffff',
              lineColor:   '#000000',
              valid: function(v) { return v; }
            });
          } catch(e) {
            // fallback: نص بديل إذا فشل الباركود
            document.getElementById('_bc_svg').outerHTML =
              '<div style="border:1px dashed #999;padding:4px;font-size:8px;text-align:center;">⚠️ باركود غير صالح</div>';
          }
        })();
      </script>`;
  }

  // ── بناء HTML الملصق الكامل ─────────────────────────────────
  async function _buildLabelHTML(product, settings) {
    const { sName, cur, bcFont, bcType, showStore, showName, showPrice, size, fs, bv } = settings;
    const W = size.w;
    const H = size.h;

    // أحجام الخطوط النسبية
    const fsStore = Math.max(5,  fs - 3);
    const fsBc    = Math.max(5,  fs - 3);
    const fsPrice = Math.max(8,  fs + 1);
    const fsProd  = Math.max(6,  fs);

    // حساب المساحة المتاحة للباركود بدقة
    const LINE_H = 1.1; // معامل تحويل px → mm
    let usedMM = 1.5; // padding عام
    if (showStore === '1' && sName) usedMM += fsStore * LINE_H + 0.5;
    if (showName  !== '0')          usedMM += fsProd  * LINE_H + 0.5;
    usedMM += fsBc * LINE_H + 0.5; // رقم الباركود
    if (showPrice !== '0')          usedMM += fsPrice * LINE_H + 0.5;

    const barsH = Math.max(5, H - usedMM);

    // اختيار نوع الباركود
    const format = _detectFormat(bv);
    const barcodeSection = bcType === 'QR'
      ? `<div style="font-family:monospace;font-size:${fsBc}px;border:1px solid #000;padding:1px;display:inline-block;margin:1px auto;">[QR:${bv}]</div>`
      : _buildBarcodeHTML(bv, W, barsH, format);

    // تنسيق السعر
    const priceStr = (typeof formatDZ === 'function')
      ? formatDZ(product.sellPrice || 0)
      : `${parseFloat(product.sellPrice || 0).toFixed(2)} ${cur || 'DA'}`;

    const prodName = product.name + (product.size ? ` — ${product.size}` : '');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script src="${JSBARCODE_CDN}"></script>
<style>
  @page {
    margin: 0 !important;
    size: ${W}mm ${H}mm;
    padding: 0 !important;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width: ${W}mm;
    height: ${H}mm;
    max-width: ${W}mm;
    max-height: ${H}mm;
    overflow: hidden;
    background: #fff;
    color: #000;
  }
  body {
    font-family: '${bcFont || 'Cairo'}', Arial, sans-serif;
    text-align: center;
    padding: 0.8mm 1mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sn {
    font-size: ${fsStore}px; font-weight: 800;
    white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; width: 100%;
    line-height: 1.1;
  }
  .pn {
    font-size: ${fsProd}px; font-weight: 900;
    white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; width: 100%;
    line-height: 1.1;
  }
  .bc-num {
    font-family: 'Courier New', monospace;
    font-size: ${fsBc}px; font-weight: 700;
    letter-spacing: 1px; direction: ltr;
    line-height: 1.1;
  }
  .pr {
    font-size: ${fsPrice}px; font-weight: 900;
    direction: ltr; line-height: 1.1;
  }
  .bc-wrap {
    width: 100%;
    direction: ltr;
    line-height: 0;
  }
  @media print {
    html, body { width: ${W}mm !important; height: ${H}mm !important; }
    * { color: #000 !important; }
  }
</style>
</head>
<body>
${showStore === '1' && sName ? `<div class="sn">${sName}</div>` : ''}
${showName  !== '0'         ? `<div class="pn">${prodName}</div>` : ''}
<div class="bc-wrap">${barcodeSection}</div>
<div class="bc-num">${bv}</div>
${showPrice !== '0'         ? `<div class="pr">${priceStr}</div>` : ''}
</body>
</html>`;
  }

  // ── الدالة الرئيسية: طباعة ملصق ────────────────────────────
  async function barcode(product, qty) {
    if (!product) return;
    const copies = Math.max(1, Math.min(999, parseInt(qty) || 1));

    const bv = (product.barcode || String(product.id || '')).trim();
    if (!bv) {
      if (typeof toast === 'function') toast('لا يوجد رقم باركود للمنتج', 'warning');
      return;
    }

    // جلب كل الإعدادات دفعة واحدة
    const [sName, cur, bcFont, bcType, showStore, showName, showPrice, rawSize, rawFs] =
      await Promise.all(['storeName','currency','barcodeFont','barcodeType',
        'barcodeShowStore','barcodeShowName','barcodeShowPrice',
        'barcodeLabelSize','barcodeFontSize'].map(k => getSetting(k)));

    const size = SIZE_MAP[rawSize || '40x20'] || SIZE_MAP['40x20'];
    const fs   = Math.max(6, Math.min(24, parseInt(rawFs) || 9));

    const settings = { sName, cur, bcFont, bcType, showStore, showName, showPrice, size, fs, bv };
    const labelHTML = await _buildLabelHTML(product, settings);

    // طباعة N نسخة بتأخير 500ms بين كل نسخة
    for (let i = 0; i < copies; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 500));
      await _printSmart(labelHTML, rawSize || '40x20');
    }
    if (copies > 1 && typeof toast === 'function') {
      toast(`🖨️ تمت طباعة ${copies} نسخة`, 'success');
    }
  }

  // ── محرك الطباعة الذكي ──────────────────────────────────────
  async function _printSmart(html, rawSize) {
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
    _iframePrint(html);
  }

  // ── طباعة عبر iframe صامت ───────────────────────────────────
  function _iframePrint(html) {
    const old = document.getElementById('_posdzBcFrame');
    if (old) old.remove();

    const f = document.createElement('iframe');
    f.id = '_posdzBcFrame';
    f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
    document.body.appendChild(f);

    const doc = f.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // انتظر تحميل JsBarcode قبل الطباعة
    f.onload = () => {
      // نعطي JsBarcode 800ms لرسم الباركود قبل الطباعة
      setTimeout(() => {
        try {
          f.contentWindow.focus();
          f.contentWindow.print();
        } catch(e) {
          const w = window.open('', '_blank', 'width=400,height=300');
          if (w) {
            w.document.write(html);
            w.document.close();
            setTimeout(() => { w.print(); w.onafterprint = () => w.close(); }, 800);
          }
        }
        setTimeout(() => { if (f.parentNode) f.remove(); }, 8000);
      }, 800);
    };
  }

  // ── اختيار الطابعة من قائمة حقيقية ─────────────────────────
  // يسأل السيرفر عن قائمة الطابعات المثبتة على الجهاز
  async function choosePrinter(type) {
    const isBarcode = type === 'barcode';
    const settingKey = isBarcode ? 'printerBarcode' : 'printerInvoice';

    // محاولة جلب قائمة الطابعات من السيرفر
    let printers = [];
    try {
      const syncEnabled = await getSetting('syncEnabled');
      const serverIP    = await getSetting('syncServerIP')   || '192.168.1.1';
      const serverPort  = await getSetting('syncServerPort') || '3000';
      if (syncEnabled === '1') {
        const resp = await fetch(
          `http://${serverIP}:${serverPort}/api/printers`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (resp.ok) {
          const data = await resp.json();
          printers = data.printers || [];
        }
      }
    } catch(_) {}

    const currentName = await getSetting(settingKey) || '';

    if (printers.length > 0) {
      // عرض قائمة حقيقية
      _showPrinterModal(printers, currentName, settingKey, isBarcode);
    } else {
      // السيرفر غير متاح — طباعة تجريبية ثم إدخال يدوي
      _fallbackPrinterDialog(type, settingKey, currentName, isBarcode);
    }
  }

  // ── مودال اختيار الطابعة (قائمة حقيقية) ────────────────────
  function _showPrinterModal(printers, currentName, settingKey, isBarcode) {
    // إزالة مودال قديم إن وجد
    document.getElementById('_printerModal')?.remove();

    const modal = document.createElement('div');
    modal.id = '_printerModal';
    modal.style.cssText = `
      position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);
      display:flex;align-items:center;justify-content:center;padding:16px;
    `;

    const title = isBarcode ? '🖨️ اختيار طابعة الباركود' : '🖨️ اختيار طابعة الفواتير';

    const listHTML = printers.map((p, i) => {
      const isSelected = p === currentName;
      return `<div class="_pitem" data-name="${p}"
        style="padding:10px 14px;border-radius:8px;cursor:pointer;margin-bottom:6px;
               border:2px solid ${isSelected ? '#7c3aed' : '#333'};
               background:${isSelected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)'};
               color:#fff;font-size:0.9rem;display:flex;align-items:center;gap:10px;
               transition:all 0.15s;"
        onmouseover="this.style.borderColor='#7c3aed';this.style.background='rgba(124,58,237,0.1)'"
        onmouseout="this.style.borderColor='${isSelected ? '#7c3aed' : '#333'}';this.style.background='${isSelected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)'}'">
        <span style="font-size:1.2rem;">${isSelected ? '✅' : '🖨️'}</span>
        <span>${p}</span>
      </div>`;
    }).join('');

    modal.innerHTML = `
      <div style="background:#1a1040;border:1px solid #7c3aed;border-radius:14px;
                  padding:20px;width:100%;max-width:420px;max-height:80vh;
                  overflow-y:auto;box-shadow:0 0 40px rgba(124,58,237,0.4);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h3 style="color:#a78bfa;font-size:1rem;font-weight:800;">${title}</h3>
          <button onclick="document.getElementById('_printerModal').remove()"
            style="background:transparent;border:none;color:#888;font-size:1.3rem;cursor:pointer;">✕</button>
        </div>
        <p style="color:#888;font-size:0.8rem;margin-bottom:12px;">
          اختر الطابعة من القائمة — ${printers.length} طابعة متاحة
        </p>
        <div id="_printerList">${listHTML}</div>
        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
          <button id="_printerConfirmBtn"
            style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;
                   border:none;border-radius:8px;padding:9px 20px;
                   font-size:0.9rem;font-weight:700;cursor:pointer;opacity:0.5;"
            disabled>✅ تأكيد الاختيار</button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    // تفعيل الاختيار
    let chosen = currentName;
    modal.querySelectorAll('._pitem').forEach(item => {
      item.addEventListener('click', () => {
        chosen = item.dataset.name;
        modal.querySelectorAll('._pitem').forEach(el => {
          el.style.borderColor = '#333';
          el.style.background  = 'rgba(255,255,255,0.05)';
          el.querySelector('span').textContent = '🖨️';
        });
        item.style.borderColor = '#7c3aed';
        item.style.background  = 'rgba(124,58,237,0.15)';
        item.querySelector('span').textContent = '✅';
        const btn = document.getElementById('_printerConfirmBtn');
        btn.disabled = false;
        btn.style.opacity = '1';
      });
    });

    document.getElementById('_printerConfirmBtn').addEventListener('click', async () => {
      if (!chosen) return;
      await setSetting(settingKey, chosen);
      // تحديث الواجهة في settings.html إذا كانت مفتوحة
      const nameKey = isBarcode ? 'printerBarcodeName' : 'printerInvoiceName';
      const cardKey = isBarcode ? 'printerBarcodeCard' : 'printerInvoiceCard';
      document.getElementById(nameKey)?.setAttribute !== undefined &&
        (document.getElementById(nameKey).textContent = chosen);
      document.getElementById(cardKey)?.classList.add('selected');
      modal.remove();
      if (typeof toast === 'function') toast(`✅ تم اختيار: ${chosen}`, 'success');
    });

    // إغلاق بالضغط خارجه
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ── Fallback: طباعة تجريبية + إدخال يدوي ───────────────────
  function _fallbackPrinterDialog(type, settingKey, currentName, isBarcode) {
    const label = isBarcode
      ? 'اكتب اسم طابعة الباركود يدوياً:'
      : 'اكتب اسم طابعة الفواتير يدوياً:';

    // طباعة اختبارية أولاً
    const testHTML = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
      <style>
        @page { size: ${isBarcode ? '40mm 20mm' : '80mm auto'}; margin:2mm; }
        body { font-family:Arial; text-align:center; font-size:${isBarcode ? '9' : '12'}px; }
      </style>
      </head><body>
      <b>POS DZ — اختبار طابعة</b><br/>
      ${isBarcode ? '<small>ملصق الباركود</small>' : '<small>فاتورة اختبارية</small>'}
      </body></html>`;

    const w = window.open('', '_blank', 'width=400,height=300,scrollbars=no');
    if (!w) {
      if (typeof toast === 'function') toast('⚠️ أجِز النوافذ المنبثقة', 'warning');
      return;
    }
    w.document.write(testHTML);
    w.document.close();

    let asked = false;
    const ask = async () => {
      if (asked) return;
      asked = true;
      try { w.close(); } catch(_) {}
      if (typeof _inputDialog === 'function') {
        const chosen = await _inputDialog(label, currentName || '');
        if (chosen?.trim()) {
          await setSetting(settingKey, chosen.trim());
          const nameKey = isBarcode ? 'printerBarcodeName' : 'printerInvoiceName';
          document.getElementById(nameKey) &&
            (document.getElementById(nameKey).textContent = chosen.trim());
          if (typeof toast === 'function') toast(`✅ تم حفظ: ${chosen.trim()}`, 'success');
        }
      }
    };

    w.onload = () => {
      setTimeout(() => {
        try { w.focus(); w.print(); } catch(_) {}
        w.onafterprint = ask;
        setTimeout(ask, 8000);
      }, 300);
    };
  }

  // API العامة
  return { barcode, choosePrinter, SIZE_MAP };

})();
