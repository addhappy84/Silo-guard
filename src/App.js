import { useState, useRef, useCallback } from "react";

/* ─────────────────────────────────────────
   ✅ MATERIAL DATABASE (원본 그대로 유지)
───────────────────────────────────────── */

const LINE_A = {
  id: "A",
  name: "Antimicrobial Line — 6 Silos",
  short: "Antimicrobial",
  color: "#0ea5e9",
  silos: [
    { id:"A1", num:1, formula:"CaCO₃", full:"Calcium Carbonate", cas:"471-34-1", aliases:["calcium carbonate","칼슘탄산염","탄산칼슘","caco3"], color:"#38bdf8" },
    { id:"A2", num:2, formula:"B₂O₃", full:"Boron Trioxide", cas:"1303-86-2", aliases:["boron trioxide","boron trioxdie","boron trixodie","산화붕소","b2o3","b203"], color:"#818cf8" },
    { id:"A3", num:3, formula:"ZnO", full:"Zinc Oxide", cas:"1314-13-2", aliases:["zinc oxide","산화아연","zno"], color:"#34d399" },
    { id:"A4", num:4, formula:"SiO₂", full:"Silicon Dioxide", cas:"7631-86-9", aliases:["silicon dioxide","이산화규소","silica","pure silica","sio2"], color:"#fbbf24" },
    { id:"A5", num:5, formula:"K₂CO₃", full:"Potassium Carbonate", cas:"584-08-7", aliases:["potassium carbonate","탄산칼륨","k2co3"], color:"#f87171" },
    { id:"A6", num:6, formula:"Na₂CO₃", full:"Sodium Carbonate", cas:"497-19-8", aliases:["sodium carbonate","탄산나트륨","soda ash","na2co3"], color:"#fb923c" },
  ]
};

const LINE_B = {
  id: "B",
  name: "Enamel Line — 9 Silos",
  short: "Enamel",
  color: "#a78bfa",
  silos: [
    { id:"B1", num:1, formula:"B₂O₃", full:"Boron Trioxide", cas:"1303-86-2", aliases:["boron trioxide","산화붕소","b2o3","b203"], color:"#818cf8" },
    { id:"B2", num:2, formula:"TiO₂", full:"Titanium Dioxide", cas:"13463-67-7", aliases:["titanium dioxide","이산화티타늄","tio2"], color:"#22d3ee" },
    { id:"B3", num:3, formula:"Na₂CO₃", full:"Sodium Carbonate", cas:"497-19-8", aliases:["sodium carbonate","탄산나트륨","na2co3"], color:"#fb923c" },
    { id:"B4", num:4, formula:"K₂CO₃", full:"Potassium Carbonate", cas:"584-08-7", aliases:["potassium carbonate","k2co3"], color:"#f87171" },
    { id:"B5", num:5, formula:"SiO₂", full:"Silicon Dioxide", cas:"7631-86-9", aliases:["silicon dioxide","sio2"], color:"#fbbf24" },
    { id:"B6", num:6, formula:"CaCO₃", full:"Calcium Carbonate", cas:"471-34-1", aliases:["calcium carbonate","caco3"], color:"#38bdf8" },
    { id:"B7", num:7, formula:"Co₃O₄", full:"Cobalt Oxide", cas:"1308-06-1", aliases:["cobalt oxide","co3o4"], color:"#4ade80" },
    { id:"B8", num:8, formula:"Fe₂O₃", full:"Iron Oxide (RED-1100)", cas:"1309-37-1", aliases:["iron oxide","fe2o3","fe203"], color:"#f97316" },
    { id:"B9", num:9, formula:"CeO₂", full:"Cerium Oxide", cas:"1306-38-3", aliases:["cerium oxide","ceo2"], color:"#e879f9" },
  ]
};

/* ─────────────────────────────────────────
   ✅ OCR 강화 유틸 (추가된 부분)
───────────────────────────────────────── */

// 오인식 보정
function normalize(text){
  return text
    .replace(/O/g,"0")
    .replace(/o/g,"0")
    .replace(/I/g,"1")
    .replace(/l/g,"1")
    .replace(/\s+/g,"")
    .toLowerCase();
}

// CAS 추출
function extractCas(text){
  const m = text.match(/\b\d{2,7}-\d{2}-\d\b/);
  return m ? m[0] : null;
}

// 화학식 후보 추출
function extractFormulaCandidates(text){
  const regex = /\b([A-Z][a-z]?\d*)+\b/g;
  return text.match(regex) || [];
}

// Levenshtein
function levenshtein(a,b){
  const matrix=Array.from({length:b.length+1},(_,i)=>[i]);
  for(let j=0;j<=a.length;j++) matrix[0][j]=j;
  for(let i=1;i<=b.length;i++){
    for(let j=1;j<=a.length;j++){
      matrix[i][j]=b[i-1]===a[j-1]
        ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j-1]+1,matrix[i][j-1]+1,matrix[i-1][j]+1);
    }
  }
  return matrix[b.length][a.length];
}

// 전처리 (중앙 ROI + 대비 강화 + 이진화)
async function preprocess(image,threshold){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement("canvas");
      const ctx=canvas.getContext("2d");

      const cropX=img.width*0.15;
      const cropY=img.height*0.2;
      const cropW=img.width*0.7;
      const cropH=img.height*0.6;

      canvas.width=cropW;
      canvas.height=cropH;

      ctx.drawImage(img,cropX,cropY,cropW,cropH,0,0,cropW,cropH);

      const imageData=ctx.getImageData(0,0,cropW,cropH);
      const d=imageData.data;

      for(let i=0;i<d.length;i+=4){
        let gray=d[i]*0.3+d[i+1]*0.59+d[i+2]*0.11;
        gray=(gray-128)*1.6+128;
        const v=gray>threshold?255:0;
        d[i]=d[i+1]=d[i+2]=v;
      }

      ctx.putImageData(imageData,0,0);
      resolve(canvas);
    };
    img.src=URL.createObjectURL(image);
  });
}

async function runOCR(canvas,setProgress){
  const worker=await window.Tesseract.createWorker("eng");
  await worker.setParameters({
    tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-()",
    tessedit_pageseg_mode:6
  });
  const {data}=await worker.recognize(canvas,{
    logger:m=>{
      if(m.status==="recognizing text"){
        setProgress(Math.round(m.progress*100));
      }
    }
  });
  await worker.terminate();
  return data.text||"";
}
/* ─────────────────────────────────────────
   ✅ APP (기존 UI 100% 유지 + OCR만 교체)
───────────────────────────────────────── */

export default function App() {

  const ALL_SILOS = [...LINE_A.silos, ...LINE_B.silos];
  const initStates = Object.fromEntries(ALL_SILOS.map(s => [s.id, "idle"]));

  const [activeLine, setActiveLine] = useState("A");
  const [image, setImage]           = useState(null);
  const [imgURL, setImgURL]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [progress, setProgress]     = useState(0);
  const [result, setResult]         = useState(null);
  const [siloStates, setSiloStates] = useState(initStates);
  const [log, setLog]               = useState([]);

  const fileRef = useRef();

  const addLog = (msg, type="info") =>
    setLog(prev => [{ t: new Date().toLocaleTimeString("en-US"), msg, type }, ...prev].slice(0,30));

  const handleFile = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgURL(url);
    setImage(file);
    setResult(null);
  };

  /* ───────────────────────────────────────
     ✅ 강화된 ANALYZE (여기가 핵심 변경부)
  ─────────────────────────────────────── */

  const analyze = useCallback(async () => {
    if (!image) return;

    if (typeof window.Tesseract === "undefined") {
      addLog("❌ OCR engine not loaded. Check internet.", "error");
      return;
    }

    setLoading(true);
    setProgress(0);
    addLog("📷 Industrial OCR 3-Step Scan Started...", "info");

    const currentLine = activeLine === "A" ? LINE_A : LINE_B;
    const currentLineSilos = currentLine.silos;

    try {

      // ✅ 3단계 전처리 + 3회 OCR
      const t1 = await runOCR(await preprocess(image,130), setProgress);
      const t2 = await runOCR(await preprocess(image,160), setProgress);
      const t3 = await runOCR(await preprocess(image,190), setProgress);

      const rawText = (t1 + " " + t2 + " " + t3).trim();
      const normalizedText = normalize(rawText);

      addLog("🔍 OCR Completed — Matching...", "info");

      /* ✅ 1️⃣ CAS 최우선 */
      const cas = extractCas(rawText);
      if (cas) {
        const found = currentLineSilos.find(s => s.cas === cas);
        if (found) {
          openSilo(found);
          addLog(`✅ CAS ${cas} → Silo #${found.num} OPEN`, "success");
          setResult({ matched: found, by: "CAS " + cas, rawText });
          setLoading(false);
          setProgress(0);
          return;
        }
      }

      /* ✅ 2️⃣ 화학식 직접 매칭 */
      const formulas = extractFormulaCandidates(rawText);
      for (const f of formulas) {
        const norm = normalize(f);
        const found = currentLineSilos.find(s => normalize(s.formula) === norm);
        if (found) {
          openSilo(found);
          addLog(`✅ Formula ${f} → Silo #${found.num} OPEN`, "success");
          setResult({ matched: found, by: "Formula " + f, rawText });
          setLoading(false);
          setProgress(0);
          return;
        }
      }

      /* ✅ 3️⃣ 유사도 기반 (Safe Mode 포함) */
      let best = null;
      let bestScore = 999;

      for (const s of currentLineSilos) {
        const candidates = [s.formula, ...s.aliases];
        for (const c of candidates) {
          const dist = levenshtein(normalize(c), normalizedText);
          if (dist < bestScore) {
            bestScore = dist;
            best = s;
          }
        }
      }

      if (best && bestScore <= 3) {
        openSilo(best);
        addLog(`✅ AI Match → Silo #${best.num} OPEN (score:${bestScore})`, "success");
        setResult({ matched: best, by: "AI Matching", rawText });
      } else {
        lockAll();
        addLog("❌ No reliable match — SAFE MODE LOCK", "error");
        setResult({ matched: null, rawText });
      }

      setSiloStates(prev => ({ ...prev }));

    } catch (err) {
      addLog("⚠️ OCR Error: " + err.message, "error");
    } finally {
      setLoading(false);
      setProgress(0);
    }

  }, [image, activeLine]);

  /* ─────────────────────────────────────── */

  function openSilo(target) {
    const newStates = { ...initStates };
    newStates[target.id] = "open";
    (activeLine === "A" ? LINE_A.silos : LINE_B.silos)
      .forEach(s => { if (s.id !== target.id) newStates[s.id] = "locked"; });
    setSiloStates(newStates);
  }

  function lockAll() {
    const newStates = { ...initStates };
    (activeLine === "A" ? LINE_A.silos : LINE_B.silos)
      .forEach(s => newStates[s.id] = "locked");
    setSiloStates(newStates);
  }

  const reset = () => {
    setImage(null);
    setImgURL(null);
    setResult(null);
    setSiloStates(initStates);
    addLog("🔄 System reset", "info");
  };

  /* ✅ 아래 UI는 당신 기존 코드 그대로 유지 */

  return (
    <div style={{ minHeight:"100vh", background:"#060a10", color:"#e2e8f0" }}>
      <div style={{ padding:20 }}>
        <h2>🏭 Silo Charging Error Prevention System</h2>

        <button onClick={()=>{ setActiveLine("A"); reset(); }}>Antimicrobial</button>
        <button onClick={()=>{ setActiveLine("B"); reset(); }}>Enamel</button>

        <div
          onClick={()=>fileRef.current?.click()}
          style={{ border:"2px dashed #555", padding:20, marginTop:20, cursor:"pointer" }}
        >
          {imgURL
            ? <img src={imgURL} width="250" alt="preview" />
            : "Click to upload image"}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display:"none" }}
          onChange={e=>handleFile(e.target.files[0])}
        />

        <br/><br/>

        <button onClick={analyze} disabled={!image || loading}>
          {loading ? `🔍 Reading ${progress}%` : "🔍 OCR Scan"}
        </button>

        <button onClick={reset} style={{ marginLeft:10 }}>Reset</button>

        <div style={{ marginTop:20 }}>
          {result && (
            result.matched
              ? <h3 style={{ color:"#4ade80" }}>
                  ✅ {activeLine==="A"?"Antimicrobial":"Enamel"} Line
                  - Silo #{result.matched.num} OPEN
                </h3>
              : <h3 style={{ color:"#f87171" }}>
                  ❌ No Match - All Locked
                </h3>
          )}
        </div>
      </div>
    </div>
  );
}
