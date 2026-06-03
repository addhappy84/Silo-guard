import { useState, useRef, useCallback } from "react";

// ─── Material Database ───────────────────────────────────────
const LINE_A = {
  id: "A",
  name: "Antimicrobial Line — 6 Silos",
  short: "Antimicrobial",
  color: "#0ea5e9",
  silos: [
    { id:"A1", num:1, formula:"CaCO₃", full:"Calcium Carbonate",   cas:"471-34-1",   aliases:["calcium carbonate","칼슘탄산염","탄산칼슘","caco3"], color:"#38bdf8" },
    { id:"A2", num:2, formula:"B₂O₃",  full:"Boron Trioxide",      cas:"1303-86-2",  aliases:["boron trioxide","boron trioxdie","boron trixodie","산화붕소","b2o3","b203"], color:"#818cf8" },
    { id:"A3", num:3, formula:"ZnO",   full:"Zinc Oxide",          cas:"1314-13-2",  aliases:["zinc oxide","산화아연","zno"], color:"#34d399" },
    { id:"A4", num:4, formula:"SiO₂",  full:"Silicon Dioxide",     cas:"7631-86-9",  aliases:["silicon dioxide","이산화규소","silica","pure silica","sio2"], color:"#fbbf24" },
    { id:"A5", num:5, formula:"K₂CO₃", full:"Potassium Carbonate", cas:"584-08-7",   aliases:["potassium carbonate","탄산칼륨","k2co3"], color:"#f87171" },
    { id:"A6", num:6, formula:"Na₂CO₃",full:"Sodium Carbonate",    cas:"497-19-8",   aliases:["sodium carbonate","탄산나트륨","soda ash","na2co3"], color:"#fb923c" },
  ]
};

const LINE_B = {
  id: "B",
  name: "Enamel Line — 9 Silos",
  short: "Enamel",
  color: "#a78bfa",
  silos: [
    { id:"B1", num:1, formula:"B₂O₃",  full:"Boron Trioxide",      cas:"1303-86-2",  aliases:["boron trioxide","boron trioxdie","boron trixodie","산화붕소","b2o3","b203"], color:"#818cf8" },
    { id:"B2", num:2, formula:"TiO₂",  full:"Titanium Dioxide",    cas:"13463-67-7", aliases:["titanium dioxide","이산화티타늄","titan dioxit","cotiox","ka-100","tio2"], color:"#22d3ee" },
    { id:"B3", num:3, formula:"Na₂CO₃",full:"Sodium Carbonate",    cas:"497-19-8",   aliases:["sodium carbonate","탄산나트륨","soda ash","na2co3"], color:"#fb923c" },
    { id:"B4", num:4, formula:"K₂CO₃", full:"Potassium Carbonate", cas:"584-08-7",   aliases:["potassium carbonate","탄산칼륨","k2co3"], color:"#f87171" },
    { id:"B5", num:5, formula:"SiO₂",  full:"Silicon Dioxide",     cas:"7631-86-9",  aliases:["silicon dioxide","이산화규소","silica","pure silica","sio2"], color:"#fbbf24" },
    { id:"B6", num:6, formula:"CaCO₃", full:"Calcium Carbonate",   cas:"471-34-1",   aliases:["calcium carbonate","칼슘탄산염","탄산칼슘","caco3"], color:"#38bdf8" },
    { id:"B7", num:7, formula:"Co₃O₄", full:"Cobalt Oxide",        cas:"1308-06-1",  aliases:["cobalt oxide","cobalt(ii,iii) oxide","tricobalt tetraoxide","산화코발트","co3o4"], color:"#4ade80" },
    { id:"B8", num:8, formula:"Fe₂O₃", full:"Iron Oxide (RED-1100)",cas:"1309-37-1", aliases:["iron oxide","iron(iii) oxide","red-1100","red 1100","red1100","산화철","fe2o3","fe203"], color:"#f97316" },
    { id:"B9", num:9, formula:"CeO₂",  full:"Cerium Oxide",        cas:"1306-38-3",  aliases:["cerium oxide","cerium dioxide","산화세륨","ceo2"], color:"#e879f9" },
  ]
};

// 핵심 키워드 → 화학식 (OCR이 단어 하나만 제대로 읽어도 잡기 위한 보조 매칭)
const KEYWORDS = [
  { k:"zinc", f:"zno" }, { k:"boron", f:"b2o3" }, { k:"cobalt", f:"co3o4" },
  { k:"cerium", f:"ceo2" }, { k:"titanium", f:"tio2" }, { k:"potassium", f:"k2co3" },
  { k:"sodium", f:"na2co3" }, { k:"calcium", f:"caco3" }, { k:"silica", f:"sio2" },
  { k:"silicon", f:"sio2" }, { k:"iron", f:"fe2o3" }, { k:"cotiox", f:"tio2" },
  { k:"red1100", f:"fe2o3" }, { k:"red-1100", f:"fe2o3" },
];

// ─── 레벤슈타인 거리 (오타 허용 매칭) ───
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b.charAt(i-1) === a.charAt(j-1)
        ? m[i-1][j-1]
        : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
    }
  }
  return m[b.length][a.length];
}

function extractCas(text) {
  const m = text.match(/\b\d{2,7}-\d{2}-\d\b/);
  return m ? m[0] : null;
}

// OCR 흔한 혼동 보정: 0↔o, 1↔l↔i, 5↔s, 8↔b 등을 한 방향으로 통일
// (화학명 매칭 정확도를 위해 알파벳 우선으로 변환한 보조 문자열 생성)
function normalizeOcr(str) {
  return str
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/5/g, "s")
    .replace(/8/g, "b")
    .replace(/\|/g, "l");
}

// ─── 텍스트 → 사일로 매칭 (CAS → 정확 → 부분 → 키워드 → 오타허용) ───
function matchFromText(rawText, silos) {
  if (!rawText) return null;
  const text = rawText.toLowerCase().replace(/\s+/g, " ");
  const compact = text.replace(/[^a-z0-9가-힣]/g, "");
  const tokens = text.split(/[^a-z0-9가-힣]+/).filter(Boolean);

  // 1순위: CAS 번호
  const cas = extractCas(rawText);
  if (cas) {
    const byCas = silos.find(s => s.cas === cas);
    if (byCas) return { silo: byCas, by: "CAS " + cas };
  }

  // 2순위: 긴 별칭 정확/부분 포함 (화학명, 제품명, 한글)
  for (const s of silos) {
    for (const a of s.aliases) {
      const ca = a.replace(/[^a-z0-9가-힣]/g, "");
      if (ca.length >= 4 && compact.includes(ca)) return { silo: s, by: a };
    }
  }

  // 3순위: 짧은 화학식 (zno, sio2 등) — 토큰 일치 또는 공백제거 포함
  for (const s of silos) {
    for (const a of s.aliases) {
      const ca = a.replace(/[^a-z0-9]/g, "");
      if (ca.length <= 5 && ca.length >= 3) {
        if (tokens.includes(a) || compact.includes(ca)) return { silo: s, by: a.toUpperCase() };
      }
    }
  }

  // 4순위: 핵심 키워드 (단어 하나만 읽혔을 때) — 정규화 버전으로도 비교
  const compactNorm = normalizeOcr(compact);
  for (const kw of KEYWORDS) {
    const kk = kw.k.replace(/[^a-z0-9]/g, "");
    if (compact.includes(kk) || compactNorm.includes(normalizeOcr(kk))) {
      const s = silos.find(si => si.aliases.some(a => a.replace(/[^a-z0-9]/g,"") === kw.f));
      if (s) return { silo: s, by: kw.k };
    }
  }

  // 5순위: 오타 허용 (레벤슈타인) — 단어 1~3개 묶어 화학명과 비교
  // OCR 혼동문자(0↔o,1↔l,5↔s)를 보정한 버전으로도 비교
  for (const s of silos) {
    for (const a of s.aliases) {
      const ca = a.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
      if (ca.length < 5) continue; // 짧은 건 오타매칭 위험 → 제외
      const caNorm = normalizeOcr(ca);
      for (let i = 0; i < tokens.length; i++) {
        let combo = "";
        for (let j = 0; j < 3 && i + j < tokens.length; j++) {
          combo += tokens[i + j];
          if (Math.abs(combo.length - ca.length) > 2) continue;
          const comboNorm = normalizeOcr(combo);
          const dist = Math.min(levenshtein(combo, ca), levenshtein(comboNorm, caNorm));
          const maxDist = ca.length >= 8 ? 2 : 1;
          if (dist > 0 && dist <= maxDist) {
            return { silo: s, by: `${a} (~${combo})` };
          }
        }
      }
    }
  }
  return null;
}

// ─── 이미지 전처리: 확대 + 흑백 + 이진화 + 회전 (한 영역) ───
function processRegion(img, sx, sy, sw, sh, scale, rotateDeg) {
  rotateDeg = rotateDeg || 0;
  // 먼저 영역을 잘라 확대+이진화한 base canvas 생성
  const base = document.createElement("canvas");
  base.width = Math.round(sw * scale);
  base.height = Math.round(sh * scale);
  const bctx = base.getContext("2d");
  bctx.drawImage(img, sx, sy, sw, sh, 0, 0, base.width, base.height);

  const imgData = bctx.getImageData(0, 0, base.width, base.height);
  const d = imgData.data;
  let sum = 0;
  const grays = new Float32Array(base.width * base.height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
    grays[p] = g; sum += g;
  }
  const mean = sum / (base.width * base.height);
  const threshold = mean * 0.80; // 평균보다 어두운 픽셀만 글자(검정)로
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = grays[p] < threshold ? 0 : 255;
    d[i] = d[i+1] = d[i+2] = v;
  }
  bctx.putImageData(imgData, 0, 0);

  if (rotateDeg === 0) return base;

  // 회전 적용: 90/270은 가로세로 교체
  const out = document.createElement("canvas");
  const rad = (rotateDeg * Math.PI) / 180;
  if (rotateDeg === 90 || rotateDeg === 270) {
    out.width = base.height; out.height = base.width;
  } else {
    out.width = base.width; out.height = base.height;
  }
  const octx = out.getContext("2d");
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, out.width, out.height);
  octx.translate(out.width / 2, out.height / 2);
  octx.rotate(rad);
  octx.drawImage(base, -base.width / 2, -base.height / 2);
  return out;
}

// 원본 이미지를 로드해서 Image 객체로
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { resolve({ img, url }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src = url;
  });
}

function SiloCard({ silo, state }) {
  const isOpen   = state === "open";
  const isLocked = state === "locked";
  return (
    <div style={{
      background: isOpen ? `${silo.color}18` : isLocked ? "#1a0505" : "#111827",
      border: `1.5px solid ${isOpen ? silo.color : isLocked ? "#7f1d1d" : "#1f2937"}`,
      borderRadius: 12, padding: "14px 10px 10px", textAlign: "center",
      transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
      transform: isOpen ? "scale(1.05)" : "scale(1)",
      boxShadow: isOpen ? `0 0 20px ${silo.color}55` : "none",
      position: "relative",
    }}>
      <div style={{ position:"relative", width:44, height:56, margin:"0 auto 8px" }}>
        <div style={{
          position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
          width:40, height:10, borderRadius:"5px 5px 0 0",
          background: isOpen ? "transparent" : isLocked ? "#dc2626" : "#374151",
          border: isOpen ? "none" : `1.5px solid ${isLocked?"#ef4444":"#4b5563"}`,
          transition:"all 0.5s ease", rotate: isOpen ? "-55deg" : "0deg",
          transformOrigin: "left center",
        }}/>
        <div style={{
          position:"absolute", top:9, left:"50%", transform:"translateX(-50%)",
          width:38, height:40, borderRadius:"3px 3px 10px 10px",
          background:`linear-gradient(180deg,${silo.color}22 0%,${silo.color}66 100%)`,
          border:`1.5px solid ${silo.color}`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
        }}>
          {isOpen && "✓"}
          {isLocked && <span style={{color:"#ef4444"}}>✗</span>}
        </div>
      </div>
      <div style={{ fontSize:15, fontWeight:800, color: isOpen ? silo.color : "#d1d5db", lineHeight:1.1 }}>
        {silo.formula}
      </div>
      <div style={{ fontSize:9, color:"#6b7280", marginTop:2 }}>{silo.full}</div>
      <div style={{ fontSize:8, color:"#4b5563", marginTop:1 }}>CAS {silo.cas}</div>
      <div style={{
        marginTop:6, fontSize:9, fontWeight:700,
        color: isOpen?"#fff": isLocked?"#ef4444":"#6b7280",
        background: isOpen ? silo.color : isLocked?"#7f1d1d":"#1f2937",
        borderRadius:8, padding:"2px 6px", display:"inline-block",
      }}>
        {isOpen?"🔓 OPEN": isLocked?"⛔ LOCKED":"🔒 STANDBY"}
      </div>
    </div>
  );
}

function LinePanel({ line, siloStates }) {
  return (
    <div style={{
      background:"#0d1117", border:`1px solid ${line.color}44`,
      borderRadius:16, padding:"16px 14px", marginBottom:16,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <div style={{ width:10,height:10,borderRadius:"50%",background:line.color,boxShadow:`0 0 8px ${line.color}` }}/>
        <span style={{ fontSize:13,fontWeight:800,color:line.color }}>{line.name}</span>
        <span style={{ fontSize:10,color:"#4b5563",marginLeft:"auto" }}>{line.silos.length} silos</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
        {line.silos.map(s => (
          <SiloCard key={s.id} silo={s} state={siloStates[s.id] || "idle"} />
        ))}
      </div>
    </div>
  );
}

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

  const analyze = useCallback(async () => {
    if (!image) return;
    if (typeof window.Tesseract === "undefined") {
      addLog("❌ OCR engine not loaded. Check your internet connection.", "error");
      return;
    }
    setLoading(true);
    setProgress(0);
    const currentLine = activeLine === "A" ? LINE_A : LINE_B;
    const currentLineSilos = currentLine.silos;

    try {
      addLog("⚙️ Enhancing image (zoom + B/W + rotation)...", "info");
      const { img, url } = await loadImage(image);

      // 긴 변이 ~1800px 되도록 확대 배율
      const scale = Math.min(3, Math.max(1.2, 1800 / Math.max(img.width, img.height)));
      const W = img.width, H = img.height;

      const worker = await window.Tesseract.createWorker("eng", 1, {
        logger: m => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        }
      });
      // 화학명/식에 쓰이는 글자만 허용 (직조무늬 오인식 줄이기)
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789()[].,-/ ",
      });

      let match = null;
      let allText = "";

      // 한 영역을 OCR하고 매칭 시도하는 헬퍼
      const tryScan = async (label, sx, sy, sw, sh, rot) => {
        const canvas = processRegion(img, sx, sy, sw, sh, scale, rot);
        const { data } = await worker.recognize(canvas);
        const txt = (data.text || "").trim();
        if (txt) {
          allText += " " + txt;
          const found = matchFromText(txt, currentLineSilos);
          if (found) return found;
        }
        return null;
      };

      // ── 1단계: 전체 이미지를 4방향 회전으로 시도 (누운 라벨 대응) ──
      const rotations = [0, 90, 180, 270];
      for (let i = 0; i < rotations.length && !match; i++) {
        const rot = rotations[i];
        addLog(`🔄 Scanning full image @ ${rot}° (${i+1}/4)...`, "info");
        match = await tryScan("full", 0, 0, W, H, rot);
      }

      // ── 2단계: 못 찾으면 세부 영역을 0°로 스캔 (중앙/상/하) ──
      if (!match) {
        const regions = [
          { name:"center", sx:W*0.10, sy:H*0.20, sw:W*0.80, sh:H*0.55 },
          { name:"top",    sx:0,      sy:0,      sw:W,      sh:H*0.55 },
          { name:"bottom", sx:0,      sy:H*0.45, sw:W,      sh:H*0.55 },
        ];
        for (let r = 0; r < regions.length && !match; r++) {
          const reg = regions[r];
          addLog(`🔍 Scanning region: ${reg.name} (${r+1}/${regions.length})...`, "info");
          match = await tryScan(reg.name, reg.sx, reg.sy, reg.sw, reg.sh, 0);
        }
      }

      // 마지막: 누적 텍스트로 한번 더
      if (!match) match = matchFromText(allText, currentLineSilos);

      await worker.terminate();

      const preview = allText.replace(/\s+/g," ").trim().slice(0,70);
      addLog(`📄 OCR text: "${preview}..."`, "info");

      const newStates = { ...initStates };
      if (match) {
        const matched = match.silo;
        newStates[matched.id] = "open";
        currentLineSilos.forEach(s => { if (s.id !== matched.id) newStates[s.id] = "locked"; });
        addLog(`✅ Matched [${match.by}] → ${currentLine.short} Line Silo #${matched.num} OPEN!`, "success");
        setResult({ matched, by: match.by, line: currentLine.name, lineShort: currentLine.short });
      } else {
        currentLineSilos.forEach(s => { newStates[s.id] = "locked"; });
        addLog(`❌ No match in this line — all locked. Try a closer photo of the name.`, "error");
        setResult({ matched: null, line: currentLine.name, lineShort: currentLine.short });
      }
      setSiloStates(newStates);
      URL.revokeObjectURL(url);
    } catch(err) {
      addLog("⚠️ Error: " + err.message, "error");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 800);
    }
  }, [image, activeLine, initStates]);

  const reset = () => {
    setImage(null); setImgURL(null); setResult(null);
    setSiloStates(initStates);
    addLog("🔄 System reset", "info");
  };

  const matched = result?.matched;
  const lineColor = activeLine === "A" ? LINE_A.color : LINE_B.color;

  return (
    <div style={{
      minHeight:"100vh", background:"#060a10", color:"#e2e8f0",
      fontFamily:"'Inter','Helvetica Neue',Arial,sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow { 0%,100%{opacity:0.6} 50%{opacity:1} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{
        background:"#0d1117", borderBottom:"1px solid #0ea5e933",
        padding:"14px 20px", display:"flex", alignItems:"center", gap:14,
      }}>
        <div style={{
          width:38,height:38,borderRadius:10,flexShrink:0,
          background:"linear-gradient(135deg,#0ea5e9,#a78bfa)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
        }}>🏭</div>
        <div>
          <div style={{ fontSize:16,fontWeight:900 }}>Silo Charging Error Prevention System</div>
          <div style={{ fontSize:10,color:"#4b5563" }}>Free OCR · Rotation + Multi-region + Binarize + Fuzzy · Antimicrobial (6) + Enamel (9)</div>
        </div>
        <div style={{ marginLeft:"auto",display:"flex",gap:6,alignItems:"center" }}>
          <div style={{ width:7,height:7,borderRadius:"50%",background:"#22c55e",
            boxShadow:"0 0 8px #22c55e",animation:"glow 2s infinite" }}/>
          <span style={{ fontSize:10,color:"#22c55e" }}>ONLINE</span>
        </div>
      </div>

      <div style={{ maxWidth:960, margin:"0 auto", padding:"16px 14px" }}>

        <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
          {[LINE_A, LINE_B].map(line => (
            <button key={line.id} onClick={() => { setActiveLine(line.id); reset(); }}
              style={{
                padding:"8px 20px", borderRadius:10, border:"none", cursor:"pointer",
                fontWeight:800, fontSize:12, transition:"all 0.2s",
                background: activeLine===line.id ? line.color : "#111827",
                color: activeLine===line.id ? "#fff" : "#6b7280",
                boxShadow: activeLine===line.id ? `0 0 16px ${line.color}66` : "none",
              }}>
              {line.short} Line — {line.silos.length} silos
            </button>
          ))}
        </div>

        <LinePanel line={LINE_A} siloStates={siloStates} />
        <LinePanel line={LINE_B} siloStates={siloStates} />

        {result && (
          <div style={{
            padding:"14px 18px", borderRadius:12, marginBottom:14,
            background: matched ? "#052e1688" : "#1c0a0988",
            border:`1px solid ${matched?"#16a34a":"#b91c1c"}`,
            display:"flex", alignItems:"center", gap:14, animation:"fadeUp 0.4s ease",
          }}>
            <span style={{ fontSize:32 }}>{matched?"✅":"❌"}</span>
            <div>
              <div style={{ fontWeight:900, fontSize:15, color: matched?"#4ade80":"#f87171" }}>
                {matched
                  ? `${result.lineShort} Line · Silo #${matched.num} (${matched.formula}) CHARGING APPROVED`
                  : `⚠️ No match — all silos locked`}
              </div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>
                {matched
                  ? <span>Matched by: <strong style={{ color:"#e2e8f0" }}>{result.by}</strong></span>
                  : <span>Could not identify. Try a clearer, closer photo of the chemical name.</span>}
              </div>
            </div>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div>
            <div style={{ fontSize:10,color:"#4b5563",fontWeight:700,marginBottom:8 }}>
              ▪ BAG SCAN ({activeLine==="A"?"Antimicrobial":"Enamel"} Line)
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}
              onDragOver={e=>e.preventDefault()}
              style={{
                border:`2px dashed ${lineColor}66`, borderRadius:12,
                minHeight:180, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                cursor:"pointer", background:"#0d1117", overflow:"hidden", position:"relative",
              }}>
              {imgURL
                ? <img src={imgURL} style={{ width:"100%",height:180,objectFit:"cover", opacity: loading?0.3:1 }} alt="bag" />
                : <>
                    <div style={{ fontSize:36,marginBottom:6 }}>📦</div>
                    <div style={{ color:"#4b5563",fontSize:12 }}>Upload bag photo</div>
                    <div style={{ color:"#374151",fontSize:10,marginTop:3 }}>Click or drag</div>
                  </>
              }
              {loading && (
                <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
                  <div style={{ fontSize:24, animation:"glow 1s infinite" }}>⏳</div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#fff", marginTop:6 }}>{progress}%</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
              onChange={e=>handleFile(e.target.files[0])} />
            <div style={{ display:"flex",gap:8,marginTop:8 }}>
              <button onClick={analyze} disabled={!image||loading}
                style={{
                  flex:1, padding:"11px 0", borderRadius:10, border:"none",
                  background: image&&!loading ? `linear-gradient(135deg,${lineColor},#6366f1)` : "#1f2937",
                  color: image&&!loading?"#fff":"#4b5563",
                  fontWeight:800, fontSize:13,
                  cursor: image&&!loading?"pointer":"not-allowed",
                }}>
                {loading ? `🔍 Scanning... ${progress}%` : "🔍 OCR Scan"}
              </button>
              <button onClick={reset} style={{
                padding:"11px 14px", borderRadius:10, border:"1px solid #1f2937",
                background:"transparent", color:"#6b7280", cursor:"pointer", fontSize:12,
              }}>Reset</button>
            </div>
            <div style={{ fontSize:9, color:"#374151", marginTop:6, lineHeight:1.4 }}>
              💡 Tip: 화학명·화학식(예: ZnO)이 잘 보이게 가까이·밝게 촬영하세요. 라벨이 누워 있어도 자동으로 4방향 회전하며 인식합니다.
            </div>
          </div>

          <div>
            <div style={{ fontSize:10,color:"#4b5563",fontWeight:700,marginBottom:8 }}>
              ▪ SYSTEM LOG
            </div>
            <div style={{
              background:"#060a10", border:"1px solid #111827",
              borderRadius:12, height:180, overflowY:"auto", padding:10,
              fontFamily:"monospace",
            }}>
              {log.length===0
                ? <div style={{ color:"#1f2937",fontSize:11,textAlign:"center",marginTop:60 }}>Standby...</div>
                : log.map((l,i) => (
                  <div key={i} style={{
                    fontSize:10, marginBottom:4, padding:"3px 6px", borderRadius:4,
                    background: l.type==="error"?"#1c0a09": l.type==="success"?"#052e16":"#0d1117",
                    color: l.type==="error"?"#f87171": l.type==="success"?"#4ade80":"#6b7280",
                    wordBreak:"break-all",
                  }}>
                    <span style={{ color:"#374151" }}>[{l.t}] </span>{l.msg}
                  </div>
                ))
              }
            </div>

            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:10,color:"#374151",marginBottom:6,fontWeight:700 }}>
                Registered Materials — {activeLine==="A"?"Antimicrobial":"Enamel"} Line
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                {(activeLine==="A"?LINE_A:LINE_B).silos.map(s => (
                  <div key={s.id} style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"4px 8px", borderRadius:6, background:"#0d1117",
                    border:`1px solid ${s.color}22`,
                  }}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:s.color,flexShrink:0 }}/>
                    <span style={{ fontSize:11,fontWeight:700,color:s.color }}>{s.formula}</span>
                    <span style={{ fontSize:9,color:"#4b5563",marginLeft:"auto" }}>#{s.num}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
