// ══════════════════════════════════════════════════════════════
//  POSDZ_PRINT — v9.0.0 — الحل النهائي
//
//  المنهج: رسم الملصق على Canvas بـ DPI الطابعة الحقيقي
//  ثم طباعة صورة PNG واحدة بدون @page وبدون margins
//
//  لماذا Canvas؟
//  • المتصفح يتجاهل @page size → Canvas يرسم بالبكسل الدقيق
//  • JsBarcode يرسم على Canvas مباشرة → باركود حقيقي قابل للمسح
//  • الصورة تُطبع بأبعاد الملصق بالمم → لا تدوير، لا هدر
// ══════════════════════════════════════════════════════════════

const POSDZ_PRINT = (() => {

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

  // DPI الطابعة الحرارية (Xprinter XP-420B = 203 DPI)
  const PRINTER_DPI = 203;
  const MM_PER_INCH = 25.4;
  const mm2px = mm => Math.round((mm / MM_PER_INCH) * PRINTER_DPI);

  // ── تحديد تنسيق الباركود ──────────────────────────────────
  function _fmt(code) {
    const s = String(code).replace(/\s/g, '');
    if (/^\d{13}$/.test(s)) return 'EAN13';
    if (/^\d{8}$/.test(s))  return 'EAN8';
    if (/^\d{12}$/.test(s)) return 'UPC';
    return 'CODE128';
  }

  function _units(code, fmt) {
    if (fmt === 'EAN13') return 95;
    if (fmt === 'EAN8')  return 67;
    if (fmt === 'UPC')   return 95;
    return (String(code).length + 3) * 11 + 35;
  }

  // ── تحميل JsBarcode مرة واحدة ─────────────────────────────
  let _bcLoaded = false;
  function _loadBC() {
    return new Promise(resolve => {
      if (typeof JsBarcode !== 'undefined') { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
      s.onload = () => { _bcLoaded = true; resolve(); };
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  // ── قطع النص إذا تجاوز العرض ──────────────────────────────
  function _clip(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  // ── رسم أشرطة بدائية (fallback) ───────────────────────────
  function _fallbackBars(ctx, x, y, w, h, code) {
    const s = String(code);
    const uw = Math.max(1, w / ((s.length + 4) * 9));
    let cx = x;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      for (let j = 0; j < 7; j++) {
        if ((c >> (6 - j)) & 1) ctx.fillRect(cx, y, uw, h);
        cx += uw;
      }
      cx += uw * 0.5;
    }
  }

  // ── رسم الملصق كاملاً على Canvas ──────────────────────────
  async function _render(product, opts) {
    const { sName, cur, bcFont, bcType,
            showStore, showName, showPrice, size, fs, bv } = opts;

    const WM = size.w, HM = size.h;
    const W  = mm2px(WM), H = mm2px(HM);
    const P  = mm2px(0.9); // padding

    // أحجام خطوط بالبكسل مناسبة لـ 203 DPI
    const FB  = Math.max(8, Math.min(26, parseInt(fs) || 10));
    const FST = Math.max(7,  FB - 2);  // اسم المتجر
    const FSP = Math.max(8,  FB);      // اسم المنتج
    const FSN = Math.max(6,  FB - 3);  // رقم الباركود
    const FSR = Math.max(9,  FB + 2);  // السعر

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let y = P;

    // اسم المتجر
    if (showStore === '1' && sName) {
      ctx.font = `800 ${FST}px "${bcFont||'Arial'}", Arial, sans-serif`;
      ctx.fillText(_clip(ctx, sName, W - P*2), W/2, y);
      y += FST + Math.round(P * 0.35);
    }

    // اسم المنتج
    if (showName !== '0') {
      const pn = product.name + (product.size ? ` — ${product.size}` : '');
      ctx.font = `900 ${FSP}px "${bcFont||'Arial'}", Arial, sans-serif`;
      ctx.fillText(_clip(ctx, pn, W - P*2), W/2, y);
      y += FSP + Math.round(P * 0.35);
    }

    // حساب الارتفاع المتاح للباركود
    let bot = P;
    bot += FSN + Math.round(P * 0.35);
    if (showPrice !== '0') bot += FSR + Math.round(P * 0.35);

    const bH = Math.max(mm2px(3.5), H - y - bot - P);
    const bW = W - P * 2;

    // رسم الباركود
    if (bcType === 'QR') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.strokeRect(W/2 - bW/2, y, bW, bH);
      ctx.font = `700 ${FSN}px monospace`;
      ctx.fillText('[QR]', W/2, y + bH/2 - FSN/2);
      y += bH + Math.round(P * 0.3);
    } else {
      const fmt = _fmt(bv);
      const bc  = document.createElement('canvas');
      let ok = false;
      if (typeof JsBarcode !== 'undefined') {
        try {
          const xd = Math.max(1, Math.floor(bW / _units(bv, fmt)));
          JsBarcode(bc, String(bv), {
            format: fmt, width: xd, height: bH,
            displayValue: false, margin: 0,
            background: '#ffffff', lineColor: '#000000',
          });
          ok = true;
        } catch(_) {}
      }
      if (ok && bc.width > 0) {
        // drawImage يوسّع الباركود ليملأ bW × bH بالكامل
        ctx.drawImage(bc, 0, 0, bc.width, bc.height, P, y, bW, bH);
      } else {
        _fallbackBars(ctx, P, y, bW, bH, bv);
      }
      y += bH + Math.round(P * 0.25);
    }

    // رقم الباركود
    ctx.font = `700 ${FSN}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(bv, W/2, y);
    y += FSN + Math.round(P * 0.35);

    // السعر
    if (showPrice !== '0') {
      const pr = (typeof formatDZ === 'function')
        ? formatDZ(product.sellPrice || 0)
        : `${parseFloat(product.sellPrice||0).toFixed(2)} ${cur||'DA'}`;
      ctx.font = `900 ${FSR}px "${bcFont||'Arial'}", Arial, sans-serif`;
      ctx.fillText(pr, W/2, y);
    }

    return canvas;
  }

  // ── تحويل Canvas إلى HTML جاهز للطباعة ───────────────────
  // الحيلة الجوهرية: صورة PNG + أبعاد بالمم + لا margins
  function _toHTML(canvas, wMM, hMM) {
    const url = canvas.toDataURL('image/png', 1.0);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  *{margin:0!important;padding:0!important;box-sizing:border-box;}
  @page{
    size:${wMM}mm ${hMM}mm!important;
    margin:0mm!important;
  }
  html,body{
    width:${wMM}mm!important;
    height:${hMM}mm!important;
    max-width:${wMM}mm!important;
    max-height:${hMM}mm!important;
    overflow:hidden!important;
    background:#fff!important;
  }
  img{
    display:block!important;
    width:${wMM}mm!important;
    height:${hMM}mm!important;
    max-width:${wMM}mm!important;
    max-height:${hMM}mm!important;
    object-fit:fill!important;
    -webkit-print-color-adjust:exact!important;
    print-color-adjust:exact!important;
  }
</style>
</head>
<body>
<img src="${url}" alt=""/>
</body>
</html>`;
  }

  // ── الدالة الرئيسية ────────────────────────────────────────
  async function barcode(product, qty) {
    if (!product) return;
    const copies = Math.max(1, Math.min(999, parseInt(qty) || 1));

    const bv = (product.barcode || String(product.id || '')).trim();
    if (!bv) {
      if (typeof toast === 'function') toast('لا يوجد رقم باركود', 'warning');
      return;
    }

    const [sName,cur,bcFont,bcType,showStore,showName,showPrice,rawSize,rawFs] =
      await Promise.all(['storeName','currency','barcodeFont','barcodeType',
        'barcodeShowStore','barcodeShowName','barcodeShowPrice',
        'barcodeLabelSize','barcodeFontSize'].map(k=>getSetting(k)));

    const size = SIZE_MAP[rawSize||'40x20'] || SIZE_MAP['40x20'];
    const fs   = Math.max(7, Math.min(24, parseInt(rawFs)||9));

    await _loadBC();

    const opts   = {sName,cur,bcFont,bcType,showStore,showName,showPrice,size,fs,bv};
    const canvas = await _render(product, opts);
    const html   = _toHTML(canvas, size.w, size.h);

    for (let i = 0; i < copies; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 600));
      await _printSmart(html, rawSize||'40x20');
    }
    if (copies > 1 && typeof toast === 'function')
      toast(`🖨️ تمت طباعة ${copies} نسخة`, 'success');
  }

  // ── محرك الطباعة ──────────────────────────────────────────
  async function _printSmart(html, rawSize) {
    try {
      const syncEnabled = await getSetting('syncEnabled');
      const serverIP    = await getSetting('syncServerIP')  || '192.168.1.1';
      const serverPort  = await getSetting('syncServerPort')|| '3000';
      if (syncEnabled === '1') {
        const pName = await getSetting('printerBarcode') || '';
        const r = await fetch(`http://${serverIP}:${serverPort}/api/print`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({html, printerName:pName, labelSize:rawSize}),
          signal:AbortSignal.timeout(6000)
        });
        if (r.ok) {
          const j = await r.json();
          if (j.status === 'ok') {
            if (typeof toast === 'function') toast(`🖨️ طباعة على: ${j.printer}`,'success');
            return;
          }
        }
      }
    } catch(_) {}
    _browserPrint(html);
  }

  // ── طباعة عبر iframe مخفي ─────────────────────────────────
  function _browserPrint(html) {
    document.getElementById('_bcF')?.remove();
    const f = document.createElement('iframe');
    f.id = '_bcF';
    f.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    f.onload = () => {
      setTimeout(() => {
        try { f.contentWindow.focus(); f.contentWindow.print(); }
        catch(e) {
          const w = window.open('','_blank','width=500,height=400');
          if (w) { w.document.write(html); w.document.close();
            setTimeout(()=>{w.print();w.onafterprint=()=>w.close();},200); }
        }
        setTimeout(()=>{ f.parentNode&&f.remove(); },10000);
      }, 200);
    };
  }

  // ── اختيار الطابعة ────────────────────────────────────────
  async function choosePrinter(type) {
    const isBc = type === 'barcode';
    const key  = isBc ? 'printerBarcode' : 'printerInvoice';
    const cur  = (await getSetting(key)) || '';
    let printers = [];
    try {
      const en  = await getSetting('syncEnabled');
      const ip  = await getSetting('syncServerIP')  || '192.168.1.1';
      const pt  = await getSetting('syncServerPort')|| '3000';
      if (en === '1') {
        const r = await fetch(`http://${ip}:${pt}/api/printers`,{signal:AbortSignal.timeout(4000)});
        if (r.ok) printers = (await r.json()).printers || [];
      }
    } catch(_) {}

    if (printers.length > 0) {
      _printerModal(printers, cur, key, isBc);
    } else {
      if (typeof _inputDialog === 'function') {
        const v = await _inputDialog(isBc?'اسم طابعة الباركود:':'اسم طابعة الفواتير:', cur);
        if (v?.trim()) {
          await setSetting(key, v.trim());
          _updUI(isBc, v.trim());
          if (typeof toast === 'function') toast(`✅ تم حفظ: ${v.trim()}`,'success');
        }
      } else {
        if (typeof toast === 'function') toast('⚠️ شغّل السيرفر لجلب قائمة الطابعات','warning');
      }
    }
  }

  function _printerModal(printers, current, key, isBc) {
    document.getElementById('_pModal')?.remove();
    const m = document.createElement('div');
    m.id = '_pModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;';
    m.innerHTML = `
      <div style="background:#1a1040;border:2px solid #7c3aed;border-radius:14px;padding:20px;width:100%;max-width:400px;max-height:75vh;overflow-y:auto;box-shadow:0 0 50px rgba(124,58,237,0.5);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3 style="color:#a78bfa;font-size:0.95rem;font-weight:800;">🖨️ ${isBc?'طابعة الباركود':'طابعة الفواتير'}</h3>
          <button onclick="document.getElementById('_pModal').remove()" style="background:transparent;border:none;color:#888;font-size:1.3rem;cursor:pointer;">✕</button>
        </div>
        <div id="_pList">
          ${printers.map(p=>`
            <div class="_pi" data-n="${p}" style="padding:10px 14px;border-radius:8px;cursor:pointer;margin-bottom:6px;border:2px solid ${p===current?'#7c3aed':'#2d1b69'};background:${p===current?'rgba(124,58,237,0.2)':'rgba(255,255,255,0.04)'};color:#e2e8f0;font-size:0.88rem;display:flex;align-items:center;gap:10px;transition:all 0.15s;">
              <span>${p===current?'✅':'🖨️'}</span><span>${p}</span>
            </div>`).join('')}
        </div>
        <div style="margin-top:14px;text-align:left;">
          <button id="_pOk" disabled style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:8px;padding:9px 22px;font-size:0.9rem;font-weight:700;cursor:pointer;opacity:0.45;transition:opacity 0.2s;">✅ تأكيد</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    let chosen = current;
    m.querySelectorAll('._pi').forEach(el=>{
      el.addEventListener('click',()=>{
        chosen = el.dataset.n;
        m.querySelectorAll('._pi').forEach(x=>{x.style.borderColor='#2d1b69';x.style.background='rgba(255,255,255,0.04)';x.querySelector('span').textContent='🖨️';});
        el.style.borderColor='#7c3aed';el.style.background='rgba(124,58,237,0.2)';el.querySelector('span').textContent='✅';
        const b=document.getElementById('_pOk');b.disabled=false;b.style.opacity='1';
      });
    });
    document.getElementById('_pOk').addEventListener('click',async()=>{
      await setSetting(key,chosen);_updUI(isBc,chosen);m.remove();
      if(typeof toast==='function') toast(`✅ تم اختيار: ${chosen}`,'success');
    });
    m.addEventListener('click',e=>{if(e.target===m)m.remove();});
  }

  function _updUI(isBc, name) {
    const n = document.getElementById(isBc?'printerBarcodeName':'printerInvoiceName');
    const c = document.getElementById(isBc?'printerBarcodeCard':'printerInvoiceCard');
    if(n) n.textContent = name;
    if(c) c.classList.add('selected');
  }

  return { barcode, choosePrinter, SIZE_MAP };

})();
