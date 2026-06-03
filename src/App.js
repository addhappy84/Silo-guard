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

// CAS 번호 패턴 (예: 1303-86-2)
function extractCas(text) {
  const m = text.match(/\b\d{2,7}-\d{2}-\d\b/);
  return m ? m[0] : null;
}

// OCR로 읽은 전체 텍스트에서 사일로 매칭
function matchFromText(rawText, silos) {
  if (!rawText) return null;
  const text = rawText.toLowerCase().replace(/\s+/g, " ");
  const cas = extractCas(rawText);

  // 1순위: CAS 번호
  if (cas) {
    const byCas = silos.find(s => s.cas.replace(/\s/g, "") === cas.replace(/\s/g, ""));
    if (byCas) return { silo: byCas, by: "CAS " + cas };
  }

  // 2순위: 긴 별칭 (화학명, 제품명) — 텍스트에 포함되어 있으면
  for (const s of silos) {
    for (const a of s.aliases) {
      if (a.length >= 5 && text.includes(a)) {
        return { silo: s, by: a };
      }
    }
  }

  // 3순위: 짧은 화학식 (zno, sio2 등) — 단어 경계로 정확히 등장할 때만
  // (공백 제거 포함매칭은 오인식이 많아 제외)
  for (const s of silos) {
    for (const a of s.aliases) {
      if (a.length <= 5) {
        const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
        if (tokens.includes(a)) {
          return { silo: s, by: a.toUpperCase() };
        }
      }
    }
  }
  return null;
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
    addLog("📷 Reading text from image (free OCR)...", "info");

    const currentLine = activeLine === "A" ? LINE_A : LINE_B;

    try {
      const worker = await window.Tesseract.createWorker("eng", 1, {
        logger: m => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        }
      });
      const { data } = await worker.recognize(image);
      await worker.terminate();

      const rawText = (data.text || "").trim();
      addLog(`🔍 OCR read: "${rawText.replace(/\n/g," ").slice(0,60)}..."`, "info");

      const currentLineSilos = currentLine.silos;
      const match = matchFromText(rawText, currentLineSilos);

      const newStates = { ...initStates };
      if (match) {
        const matched = match.silo;
        newStates[matched.id] = "open";
        currentLineSilos.forEach(s => { if (s.id !== matched.id) newStates[s.id] = "locked"; });
        addLog(`✅ Matched [${match.by}] → ${currentLine.short} Line Silo #${matched.num} OPEN!`, "success");
        setResult({ matched, by: match.by, rawText, line: currentLine.name, lineShort: currentLine.short });
      } else {
        currentLineSilos.forEach(s => { newStates[s.id] = "locked"; });
        addLog(`❌ No match found in this line — all locked. Try a clearer photo.`, "error");
        setResult({ matched: null, rawText, line: currentLine.name, lineShort: currentLine.short });
      }
      setSiloStates(newStates);
    } catch(err) {
      addLog("⚠️ Error: " + err.message, "error");
    } finally {
      setLoading(false);
      setProgress(0);
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
          <div style={{ fontSize:10,color:"#4b5563" }}>Free OCR (Tesseract) · Antimicrobial (6) + Enamel (9)</div>
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
                cursor:"pointer", background:"#0d1117", overflow:"hidden",
              }}>
              {imgURL
                ? <img src={imgURL} style={{ width:"100%",height:180,objectFit:"cover" }} alt="bag" />
                : <>
                    <div style={{ fontSize:36,marginBottom:6 }}>📦</div>
                    <div style={{ color:"#4b5563",fontSize:12 }}>Upload bag photo</div>
                    <div style={{ color:"#374151",fontSize:10,marginTop:3 }}>Click or drag</div>
                  </>
              }
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
                {loading ? `🔍 Reading... ${progress}%` : "🔍 OCR Scan"}
              </button>
              <button onClick={reset} style={{
                padding:"11px 14px", borderRadius:10, border:"1px solid #1f2937",
                background:"transparent", color:"#6b7280", cursor:"pointer", fontSize:12,
              }}>Reset</button>
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
