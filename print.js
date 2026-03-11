// ═══════════════════════════════════════
// POSDZ PRINT ENGINE v12
// Stable Barcode Label Printing
// ═══════════════════════════════════════

const POSDZ_PRINT_ENGINE = (() => {

const DPI = 203;
const MM = 25.4;

const mm2px = mm => Math.round((mm/MM)*DPI);


// ─────────────────────────────
// إنشاء صفحة الطباعة
// ─────────────────────────────

function makeHTML(canvas,wMM,hMM){

const png = canvas.toDataURL("image/png",1);

const orientation = wMM>hMM ? "landscape":"portrait";

return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
}

@page{
size:${wMM}mm ${hMM}mm ${orientation};
margin:0;
}

html,body{
width:${wMM}mm;
height:${hMM}mm;
overflow:hidden;
background:#fff;
}

body{
display:flex;
align-items:center;
justify-content:center;
}

img{
width:${wMM}mm;
height:${hMM}mm;
object-fit:fill;
image-rendering:pixelated;
-webkit-print-color-adjust:exact;
print-color-adjust:exact;
}

@media print{

html,body{
width:${wMM}mm !important;
height:${hMM}mm !important;
}

img{
width:${wMM}mm !important;
height:${hMM}mm !important;
}

}

</style>

</head>

<body>

<img src="${png}">

<script>

function start(){

setTimeout(()=>{

window.focus();
window.print();

window.onafterprint=()=>window.close();

},300);

}

window.onload=start;

</script>

</body>
</html>
`;
}


// ─────────────────────────────
// محرك الطباعة
// ─────────────────────────────

function iframePrint(html){

document.getElementById("_posdzPrint")?.remove();

const frame=document.createElement("iframe");

frame.id="_posdzPrint";

frame.style.position="fixed";
frame.style.right="0";
frame.style.bottom="0";
frame.style.width="0";
frame.style.height="0";
frame.style.border="0";
frame.style.visibility="hidden";

document.body.appendChild(frame);

const doc=frame.contentWindow.document;

doc.open();
doc.write(html);
doc.close();

frame.onload=()=>{

setTimeout(()=>{

try{

frame.contentWindow.focus();
frame.contentWindow.print();

}catch{

popupPrint(html);

}

setTimeout(()=>frame.remove(),10000);

},400);

};

}


// ─────────────────────────────
// fallback popup
// ─────────────────────────────

function popupPrint(html){

const w=window.open("","_blank","width=400,height=300");

if(!w) return;

w.document.open();
w.document.write(html);
w.document.close();

}


// ─────────────────────────────
// طباعة ملصق
// ─────────────────────────────

async function printLabel(canvas,wMM,hMM,copies=1){

const html=makeHTML(canvas,wMM,hMM);

for(let i=0;i<copies;i++){

if(i>0) await new Promise(r=>setTimeout(r,600));

iframePrint(html);

}

}


return{
printLabel,
mm2px
};

})();
