import { useState, useRef, useCallback } from "react";

// Gemini 무료 API 키 (Netlify 환경변수에서 주입)
const GEMINI_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";

// ─── Gemini AI로 사진에서 화학물질 판단 (OCR 실패 시 2차) ───
// 등록된 원료 목록 + OCR이 읽은 텍스트를 힌트로 주고, 어느 것인지 판단
async function askGemini(base64Jpeg, silos, ocrHint) {
  const list = silos.map(s => `${s.formula} (${s.full}, CAS ${s.cas})`).join("; ");
  const hint = ocrHint && ocrHint.trim()
    ? `\n\nFor reference, a rough OCR scan of the image read (may contain errors): "${ocrHint.slice(0, 200)}"`
    : "";
  const prompt =
`You are a strict chemical material identifier for a factory silo system.
Look at this photo of a chemical material bag and identify which ONE of the registered materials it is.

Registered materials: ${list}${hint}

Rules:
- Identify based on visible text: chemical name, chemical formula, CAS number, or product code (e.g. "RED-1100" means Fe2O3, "PURE SILICA" means SiO2, "COTIOX"/"KA-100" means TiO2).
- Respond with ONLY the chemical formula exactly as listed (e.g. "ZnO", "B2O3", "Fe2O3"). No other words.
- If you are NOT confident it is one of the registered materials, respond with exactly "NONE".
- Never guess. Safety first.`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/jpeg", data: base64Jpeg } },
      ],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 800,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Gemini " + res.status + ": " + t.slice(0, 80));
  }
  const data = await res.json();
  // 응답에서 텍스트 추출 (여러 part 합치기)
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || "").join(" ").trim();
  return text;
}

// Gemini가 답한 화학식을 등록 사일로와 매칭
function matchGeminiAnswer(answer, silos) {
  if (!answer) return null;
  const norm = (str) => str.toLowerCase()
    .replace(/₀/g,"0").replace(/₁/g,"1").replace(/₂/g,"2").replace(/₃/g,"3").replace(/₄/g,"4")
    .replace(/[^a-z0-9]/g, "");
  const low = answer.toLowerCase();
  if (low.includes("none")) return null;
  const a = norm(answer);
  if (!a) return null;

  // 1) 화학식 정확 일치
  for (const s of silos) {
    if (norm(s.formula) === a) return s;
  }
  // 2) 답변 문자열 안에 화학식이 포함 (문장으로 답한 경우)
  for (const s of silos) {
    const f = norm(s.formula);
    if (f.length >= 3 && a.includes(f)) return s;
  }
  // 3) 별칭 일치/포함
  for (const s of silos) {
    for (const al of s.aliases) {
      const an = al.replace(/[^a-z0-9]/g, "");
      if (an.length >= 4 && (an === a || low.includes(al.toLowerCase()))) return s;
    }
  }
  return null;
}

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

// ─── 엄격 매칭: 확실할 때만 승인, 애매하면 null(거부) ───
// 반환: { silo, by, strong } — strong=true면 확실, false면 약한근거(2차 AI 권장)
function matchFromText(rawText, silos) {
  if (!rawText) return null;
  const text = rawText.toLowerCase().replace(/\s+/g, " ");
  const tokens = text.split(/[^a-z0-9가-힣]+/).filter(Boolean);
  const tokenSet = new Set(tokens);

  // ── 1순위: CAS 번호 정확 일치 (가장 신뢰, 무조건 승인) ──
  const cas = extractCas(rawText);
  if (cas) {
    const byCas = silos.find(s => s.cas === cas);
    if (byCas) return { silo: byCas, by: "CAS " + cas, strong: true };
  }

  // ── 2순위: 화학명/제품명이 토큰으로 명확히 등장 ──
  // (쓰레기 텍스트 속 우연한 부분포함 차단을 위해 '단어 단위'로만 인정)
  // 멀티워드 별칭(예: "calcium carbonate")은 모든 단어가 토큰에 있어야 함
  for (const s of silos) {
    for (const a of s.aliases) {
      const words = a.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        // 두 단어 이상: 모든 단어가 각각 토큰으로 존재해야 (강한 근거)
        const allPresent = words.every(w => {
          const wc = w.replace(/[^a-z0-9가-힣]/g, "");
          return wc.length >= 3 && tokenSet.has(wc);
        });
        if (allPresent) return { silo: s, by: a, strong: true };
      }
    }
  }

  // ── 3순위: 한글 화학명 (탄산칼슘 등) 토큰/포함 ──
  for (const s of silos) {
    for (const a of s.aliases) {
      if (/[가-힣]/.test(a)) {
        const ka = a.replace(/[^가-힣]/g, "");
        if (ka.length >= 3 && text.includes(ka)) return { silo: s, by: a, strong: true };
      }
    }
  }

  // ── 4순위: 화학식 (zno, tio2, b2o3 등)이 '독립 토큰'으로 정확히 등장 ──
  // 핵심: 부분포함(includes) 금지. 반드시 단어 하나가 화학식과 정확히 일치해야 함.
  // 추가 안전장치: 숫자를 포함한 화학식만 인정 (b2o3, tio2 등) — 순수문자(zno)는 단독+짧아서 위험
  for (const s of silos) {
    for (const a of s.aliases) {
      const ca = a.toLowerCase().replace(/[^a-z0-9]/g, "");
      // 화학식 후보: 3~6자, 숫자 포함 (예: b2o3, tio2, caco3, sio2, co3o4, fe2o3, ceo2, k2co3, na2co3)
      if (ca.length >= 3 && ca.length <= 6 && /[0-9]/.test(ca)) {
        if (tokenSet.has(ca)) return { silo: s, by: ca.toUpperCase(), strong: true };
        // 정규화(0↔o,1↔l) 후 토큰 일치도 인정
        const caN = normalizeOcr(ca);
        for (const t of tokens) {
          if (t.length === ca.length && normalizeOcr(t) === caN) {
            return { silo: s, by: ca.toUpperCase(), strong: true };
          }
        }
      }
    }
  }

  // ── 5순위: 단일 단어 화학명(긴 것)만 레벤슈타인 (예: titanium, potassium) ──
  // 매우 엄격: 별칭 단어 길이 7+ & 오차 1글자 이하 & 길이차 1 이하
  for (const s of silos) {
    for (const a of s.aliases) {
      const words = a.toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length !== 1) continue;
      const w = words[0].replace(/[^a-z0-9]/g, "");
      if (w.length < 7) continue; // 7자 미만은 오타매칭 위험 → 제외
      for (const t of tokens) {
        if (Math.abs(t.length - w.length) > 1) continue;
        const dist = Math.min(levenshtein(t, w), levenshtein(normalizeOcr(t), normalizeOcr(w)));
        if (dist > 0 && dist <= 1) {
          return { silo: s, by: `${a} (~${t})`, strong: false }; // 약한 근거
        }
      }
    }
  }

  // ── 제품명 RED-1100 등 특수 코드 (정확 토큰만) ──
  for (const s of silos) {
    for (const a of s.aliases) {
      const ca = a.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (/^red\d{3,4}$/.test(ca) || ca === "cotiox") {
        const aN = a.toLowerCase().replace(/\s/g, "");
        for (const t of tokens) {
          if (t === ca || t === aN) return { silo: s, by: a, strong: true };
        }
      }
    }
  }

  return null; // 확실한 근거 없음 → 거부 (오인식 방지)
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

      let weakMatch = null; // 약한 근거는 보류했다가 strong 없을 때만 후보

      // ── 1단계: 전체 이미지를 4방향 회전으로 시도 (누운 라벨 대응) ──
      const rotations = [0, 90, 180, 270];
      for (let i = 0; i < rotations.length && !(match && match.strong); i++) {
        const rot = rotations[i];
        addLog(`🔄 Scanning full image @ ${rot}° (${i+1}/4)...`, "info");
        const found = await tryScan("full", 0, 0, W, H, rot);
        if (found && found.strong) { match = found; }
        else if (found && !weakMatch) { weakMatch = found; }
      }

      // ── 2단계: strong 못 찾으면 세부 영역을 0°로 스캔 (중앙/상/하) ──
      if (!(match && match.strong)) {
        const regions = [
          { name:"center", sx:W*0.10, sy:H*0.20, sw:W*0.80, sh:H*0.55 },
          { name:"top",    sx:0,      sy:0,      sw:W,      sh:H*0.55 },
          { name:"bottom", sx:0,      sy:H*0.45, sw:W,      sh:H*0.55 },
        ];
        for (let r = 0; r < regions.length && !(match && match.strong); r++) {
          const reg = regions[r];
          addLog(`🔍 Scanning region: ${reg.name} (${r+1}/${regions.length})...`, "info");
          const found = await tryScan(reg.name, reg.sx, reg.sy, reg.sw, reg.sh, 0);
          if (found && found.strong) { match = found; }
          else if (found && !weakMatch) { weakMatch = found; }
        }
      }

      // 마지막: 누적 텍스트로 한번 더 (strong만 채택)
      if (!(match && match.strong)) {
        const last = matchFromText(allText, currentLineSilos);
        if (last && last.strong) match = last;
        else if (last && !weakMatch) weakMatch = last;
      }
      // strong이 없으면 약한 매칭을 match 자리에 (strong=false라 아래서 AI로 넘어감)
      if (!match) match = weakMatch;

      await worker.terminate();

      const preview = allText.replace(/\s+/g," ").trim().slice(0,70);
      addLog(`📄 OCR text: "${preview}..."`, "info");

      const newStates = { ...initStates };

      // ── OCR(1차)로 확실히 잡힌 경우 → 즉시 승인 ──
      if (match && match.strong) {
        const matched = match.silo;
        newStates[matched.id] = "open";
        currentLineSilos.forEach(s => { if (s.id !== matched.id) newStates[s.id] = "locked"; });
        addLog(`✅ Matched [${match.by}] → ${currentLine.short} Line Silo #${matched.num} OPEN!`, "success");
        setResult({ matched, by: match.by, line: currentLine.name, lineShort: currentLine.short });
        setSiloStates(newStates);
        URL.revokeObjectURL(url);
        return;
      }

      // ── OCR이 실패했거나 약한 근거 → 2차: Gemini AI 판단 ──
      if (GEMINI_KEY) {
        addLog("🤖 OCR uncertain. Asking AI (Gemini) for confirmation...", "info");
        try {
          // 원본 이미지를 적당히 줄여 jpeg base64로 변환 (용량/속도)
          const aiCanvas = document.createElement("canvas");
          const aiScale = Math.min(1, 1024 / Math.max(img.width, img.height));
          aiCanvas.width = Math.round(img.width * aiScale);
          aiCanvas.height = Math.round(img.height * aiScale);
          aiCanvas.getContext("2d").drawImage(img, 0, 0, aiCanvas.width, aiCanvas.height);
          const dataUrl = aiCanvas.toDataURL("image/jpeg", 0.85);
          const b64 = dataUrl.split(",")[1];

          const answer = await askGemini(b64, currentLineSilos, allText);
          addLog(`🤖 AI answer: "${answer}"`, "info");
          const aiSilo = matchGeminiAnswer(answer, currentLineSilos);

          if (aiSilo) {
            newStates[aiSilo.id] = "open";
            currentLineSilos.forEach(s => { if (s.id !== aiSilo.id) newStates[s.id] = "locked"; });
            addLog(`✅ AI confirmed → ${currentLine.short} Line Silo #${aiSilo.num} OPEN!`, "success");
            setResult({ matched: aiSilo, by: "AI (" + answer + ")", line: currentLine.name, lineShort: currentLine.short });
            setSiloStates(newStates);
            URL.revokeObjectURL(url);
            return;
          } else {
            addLog(`❌ AI could not confirm a registered material — locked.`, "error");
          }
        } catch (aiErr) {
          addLog("⚠️ AI error: " + aiErr.message, "error");
        }
      }

      // ── 1차·2차 모두 실패 → 안전하게 전체 잠금 ──
      currentLineSilos.forEach(s => { newStates[s.id] = "locked"; });
      addLog(`❌ No confident match — all locked. Try a closer photo of the name/CAS.`, "error");
      setResult({ matched: null, line: currentLine.name, lineShort: currentLine.short });
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
          <div style={{ fontSize:10,color:"#4b5563" }}>Free OCR + AI fallback (Gemini) · Strict · Antimicrobial (6) + Enamel (9)</div>
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
