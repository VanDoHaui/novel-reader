import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";

function useIsMobile() {
  const [mob, setMob] = useState(()=>typeof window!=="undefined"&&window.innerWidth<768);
  useEffect(()=>{
    const fn = ()=>setMob(window.innerWidth<768);
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[]);
  return mob;
}
import * as mammoth from "mammoth";

const NOVEL_META = {
  title: "Overgeared",
  author: "Park Saenal (박새날)",
  translator: "rainbowturtle",
  tags: ["Korean", "LitRPG", "Action", "Virtual Reality", "Crafting"],
  licensedFrom: "Mayamaru",
  desc: "Shin Youngwoo has had an unfortunate life and is now stuck carrying bricks on construction sites. He even had to do labor in the VR game, Satisfy! However, luck would soon come his way when he discovers a hidden piece that changes his entire destiny.",
};

// ── SUPABASE ─────────────────────────────────────────────────────────────────
const SB_URL = "https://ibnkdfltckcjfmdxtkiq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlibmtkZmx0Y2tjamZtZHh0a2lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTE1ODcsImV4cCI6MjA4Nzg2NzU4N30.PfWLbGwYREwYLk8EC1ySh16hO9zC9PauBqDGQ1mjDWU";
const sbH = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "resolution=merge-duplicates"
};
async function sbLoad() {
  try {
    const PAGE = 1000;
    let all = [], from = 0;
    while(true) {
      const r = await fetch(`${SB_URL}/rest/v1/chapters?select=id,title&order=id.asc`, {
        headers: {...sbH, "Range": `${from}-${from+PAGE-1}`, "Range-Unit": "items"}
      });
      if(!r.ok) { console.error("sbLoad error", r.status, await r.text()); break; }
      const data = await r.json();
      if(!data || !data.length) break;
      all = all.concat(data);
      if(data.length < PAGE) break;
      from += PAGE;
    }
    return all.length ? all : null;
  } catch(e) { console.error("sbLoad fetch error", e); return null; }
}
// Load 1 chương đầy đủ khi user click đọc
async function sbLoadOne(id) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/chapters?select=id,title,paragraphs&id=eq.${id}`, {headers: sbH});
    if (!r.ok) return null;
    const data = await r.json();
    return data?.[0] || null;
  } catch(e) { return null; }
}
async function sbSave(ch) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/chapters`, {
      method: "POST",
      headers: { ...sbH, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({id: ch.id, title: ch.title, paragraphs: ch.paragraphs})
    });
    if (!r.ok) console.error("sbSave error", r.status, await r.text());
    else console.log("✓ Saved:", ch.title);
  } catch(e) { console.error("sbSave error", e); }
}
async function sbDelete(id) {
  try {
    await fetch(`${SB_URL}/rest/v1/chapters?id=eq.${id}`, {method: "DELETE", headers: sbH});
  } catch(e) { console.error("sbDelete error", e); }
}

// Progress sync — đồng bộ tiến độ đọc giữa các thiết bị
async function sbLoadProgress() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/user_progress?id=eq.default&select=*`, {headers: sbH});
    if (!r.ok) return null;
    const data = await r.json();
    return data?.[0] || null;
  } catch { return null; }
}
async function sbSaveProgress(progress) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/user_progress`, {
      method: "POST",
      headers: {
        "apikey": SB_KEY,
        "Authorization": `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({id: "default", ...progress})
    });
    if(!r.ok) { const t = await r.text(); console.error("sbSaveProgress error", r.status, t); }
  } catch(e) { console.error("sbSaveProgress error", e); }
}
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_CHAPTERS = [];
const themes = {
  light: { bg:"#F7F7F8", s:"#FFFFFF", s2:"#F0F0F2", hv:"#E8E8EC", tx:"#111118", tx2:"#5C5C6D", tx3:"#9494A3", bd:"#E2E2E8", ac:"#3B82F6", acBg:"#3B82F610", sh:"0 2px 12px rgba(0,0,0,0.07)", nav:"#FFFFFFEE", rd:"#F7F7F8", boxBg:"#FFFFFF", boxBd:"#D0D0D8", boxTx:"#111118", boxHd:"#FFFFFF", boxHdTx:"#111118" },
  dark:  { bg:"#0E0E11", s:"#1A1A20", s2:"#25252D", hv:"#32323D", tx:"#EEEEF0", tx2:"#9494A3", tx3:"#6B6B7B", bd:"#2A2A35", ac:"#3B82F6", acBg:"#3B82F618", sh:"0 2px 12px rgba(0,0,0,0.35)", nav:"#1A1A20EE", rd:"#0E0E11", boxBg:"#FFFFFF", boxBd:"#D0D0D8", boxTx:"#111118", boxHd:"#FFFFFF", boxHdTx:"#111118" },
  sepia: { bg:"#F5EDD6", s:"#FDF8EC", s2:"#EDE4CB", hv:"#E5DABC", tx:"#3C2A14", tx2:"#7C6347", tx3:"#A08B70", bd:"#DDD1B4", ac:"#B45309", acBg:"#B4530912", sh:"0 2px 12px rgba(60,42,20,0.09)", nav:"#FDF8ECEE", rd:"#F5EDD6", boxBg:"#FFFFFF", boxBd:"#D0D0D8", boxTx:"#111118", boxHd:"#FFFFFF", boxHdTx:"#111118" },
};

const FONTS = [
  { n:"Arial",        f:"Arial, sans-serif" },
  { n:"Lora",         f:"'Lora', Georgia, serif" },
  { n:"Merriweather", f:"'Merriweather', serif" },
  { n:"Noto Serif",   f:"'Noto Serif', serif" },
  { n:"Source Sans",  f:"'Source Sans 3', sans-serif" },
];

const I = {
  Home:  ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Book:  ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Upload:()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Gear:  ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  L:     ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  R:     ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  List:  ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  X:     ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check: ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Sun:   ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon:  ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Down:  ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  UpArr: ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>,
  Play:  ()=><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
};

// Detect navigation bar lines like "←Trước___Bình luận___Kế→" or "←Trước->Kế->"
function isNavBar(line) {
  return /←|→|<-|->/.test(line) && /(Trước|Kế|Bình\s*luận|Prev|Next|Chapter)/i.test(line);
}

function isSFX(line) {
  const clean = line.trim().replace(/^[\u201c\u201d\u201e\u201f"']+|[\u201c\u201d\u201e\u201f"']+$/g, '').trim();
  const words = clean.split(/\s+/);
  if (!words.length || words.length > 5) return false;
  const allSFX = words.every(w => /^[A-Za-z\u00C0-\u024F\u1E00-\u1EFF!?.…\-]+$/.test(w));
  if (!allSFX) return false;
  // Phải có chữ lặp (aaa, ááá, kkk) - dấu hiệu âm thanh, không phải câu thoại thật
  const hasRepeat = /(.)\1/.test(clean);
  // Hoặc toàn ASCII không dấu (Ttang, Pachichik, Peng...)
  const allAscii = /^[A-Za-z!?.…\- ]+$/.test(clean);
  return (hasRepeat || allAscii) && clean.length <= 40;
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\n")
    .replace(/<\/th>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function parseDocx(file) {
  const ab = await file.arrayBuffer();
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer: ab });
  const html = htmlResult.value;
  const blocks = [];

  let navbarFound = false;
  const processTextHtml = (chunk) => {
    const paraRe = /<(p|h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = paraRe.exec(chunk)) !== null) {
      const txt = stripTags(m[2]).replace(/\s+/g, " ")
        .replace(/\[\d+\]/g, "")
        .replace(/\s*↑\s*$/, "")
        .trim();
      if (!txt) continue;
      if (isNavBar(txt)) { navbarFound = true; continue; }
      if (navbarFound) continue; // bỏ tất cả sau navbar
      if (/↑/.test(txt)) continue; // chú thích dịch giả
      if (isSFX(txt)) continue;
      if (/^[·•.\-_=\s]+$/.test(txt)) continue;
      if (/^https?:\/\/\S+$/.test(txt)) continue;
      blocks.push({ type: "text", content: txt });
    }
  };

  const processTable = (tableHtml) => {
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cm;
    const allLines = [];
    while ((cm = cellRe.exec(tableHtml)) !== null) {
      const cellText = stripTags(cm[1]);
      const lines = cellText
        .split(/\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !/^[·•.\-_=]+$/.test(l));
      allLines.push(...lines);
    }
    if (allLines.length) blocks.push({ type: "box", content: allLines.join("\n") });
  };

  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let lastIndex = 0;
  let match;
  tableRe.lastIndex = 0;
  while ((match = tableRe.exec(html)) !== null) {
    if (match.index > lastIndex) processTextHtml(html.slice(lastIndex, match.index));
    processTable(match[0]);
    lastIndex = tableRe.lastIndex;
  }
  if (lastIndex < html.length) processTextHtml(html.slice(lastIndex));

  return blocks;
}

async function parseTxt(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsText(file, "utf-8");
  });
}

function cleanLine(line) {
  // Strip nav bars: "←Trước___Bình luận___Kế→" or "←Trước___->Kế->"
  if (isNavBar(line)) return "";
  // Strip URLs (footnote links, google drive, etc.)
  if (/https?:\/\/\S+/.test(line)) return "";
  // Xóa cả dòng nếu có ↑ (chú thích dịch giả)
  if (/↑/.test(line)) return "";
  return line
    .replace(/←[^\n]*[→>]/g, "")   // ← ... → or ← ... ->
    .replace(/_{4,}/g, "")
    .replace(/\s*↑\s*$/g, "")       // ↑ ở cuối dòng (back-reference)
    .replace(/\[\d+\]/g, "")        // [1] [2] [3] footnote numbers
    .trim();
}

function textToBlocks(raw) {
  const lines = raw.split(/\n/).map(cleanLine);
  const blocks = [];
  let i = 0;
  // Tìm navbar cuối cùng, bỏ tất cả nội dung sau đó
  let lastNavIdx = -1;
  for(let k=0; k<lines.length; k++){
    if(isNavBar(raw.split(/\n/)[k])) lastNavIdx = k;
  }
  const cutoff = lastNavIdx > 0 ? lastNavIdx : lines.length;

  while (i < Math.min(lines.length, cutoff)) {
    const line = lines[i];
    if (!line || /^[\s·•.\-*_]+$/.test(line) || isSFX(line)) { i++; continue; }

    const isSep = l => /^[-=_*]{3,}$/.test(l.trim());
    if (isSep(line)) {
      i++;
      const boxLines = [];
      while (i < lines.length && !isSep(lines[i])) {
        const bl = lines[i].trim();
        if (bl) boxLines.push(bl);
        i++;
      }
      i++;
      if (boxLines.length) blocks.push({ type: "box", content: boxLines.join("\n") });
      continue;
    }

    blocks.push({ type: "text", content: line });
    i++;
  }

  return blocks;
}

function extractMeta(file, blocks, fallbackNum) {
  const nameNoExt = file.name.replace(/\.(docx?|txt)$/i, "").trim();
  const numMatch = nameNoExt.match(/(\d+)/);
  const chNum = numMatch ? parseInt(numMatch[1]) : fallbackNum;
  let title = nameNoExt || `Chương ${chNum}`;
  let body = blocks;

  const first = blocks[0];
  if (first && first.type === "text" && first.content.length < 120 &&
      /^(chương|chapter|ch\.?\s*\d)/i.test(first.content.trim())) {
    body = blocks.slice(1);
  }

  return {
    id: chNum,
    title,
    fileName: file.name, // FIX 5: store filename separately instead of the File object
    paragraphs: body.length ? body : [{ type:"text", content:"(Nội dung trống)" }]
  };
}

// Stat color by label
function statColor(label) {
  const l = label.trim();
  if (/^(Máu|HP)/.test(l))   return "#e74c3c";
  if (/^(Mana|MP)/.test(l))  return "#8e44ad";
  if (/^Sức mạnh/.test(l))   return "#e67e22";
  if (/^Thể lực/.test(l))    return "#27ae60";
  if (/^Nhanh nhẹn/.test(l)) return "#16a085";
  if (/^Trí tuệ/.test(l))    return "#2980b9";
  if (/^Khéo tay/.test(l))   return "#d35400";
  if (/^Bền bỉ/.test(l))     return "#7f8c8d";
  if (/^Điềm tĩnh/.test(l))  return "#1abc9c";
  if (/^Bất khuất/.test(l))  return "#c0392b";
  if (/^Nhân phẩm/.test(l))  return "#f39c12";
  if (/^Thấu hiểu/.test(l))  return "#9b59b6";
  if (/^Dũng khí/.test(l))   return "#e91e63";
  if (/^(Tổng|Total)/.test(l)) return "#27ae60";
  if (/^(Phòng thủ|Defense)/.test(l)) return "#607d8b";
  if (/^(Pháp Lực|Magic)/.test(l)) return "#7b1fa2";
  if (/^(Sức Tấn công|Attack)/.test(l)) return "#bf360c";
  return null;
}

// Parse any line into {label, val}
function parseStat(line) {
  // Nếu có ] thì tìm : sau ] cuối cùng (tránh : trong tên item [[...]])
  const lastBracket = line.lastIndexOf("]");
  let colonIdx;
  if (lastBracket !== -1) {
    // Tìm : sau ] cuối
    const afterBracket = line.indexOf(":", lastBracket);
    colonIdx = afterBracket !== -1 ? afterBracket : line.indexOf(":");
  } else {
    colonIdx = line.indexOf(":");
  }
  if (colonIdx === -1) return { label: line, val: "" };
  return {
    label: line.slice(0, colonIdx).trim(),
    val: line.slice(colonIdx + 1).trim(),
  };
}

// Classify a single line
function sentenceCase(str) {
  // Hoa chữ cái đầu mỗi từ, bỏ ngoặc vuông nếu có
  const inner = str.replace(/^\[(.+)\]$/, '$1');
  const titled = inner.toLowerCase().replace(/(^|\s)(\S)/g, (_,a,b) => a + b.toUpperCase());
  return str.startsWith('[') ? `[${titled}]` : titled;
}

function classify(line) {
  if (/^\*/.test(line)) return "bullet";

  // [Tên vật phẩm / kỹ năng] → section header
  // Thông báo hệ thống kết thúc bằng dấu . hoặc ! hoặc có từ chủ ngữ → note
  if (/^\[.+\]$/.test(line)) {
    const inner = line.slice(1, -1);
    const isNotification = /[.!?]$/.test(inner) ||
      inner.length > 60 ||
      /\b(đã|đang|sẽ|bạn|Bạn|các|toàn bộ)\b/i.test(inner);
    return isNotification ? "note" : "section";
  }

  // [[label] extra]: value hoặc [label] extra: value → stat
  if (/^\[.+\].+:/.test(line)) return "stat";

  // Key : Value — key up to 60 chars to handle "Điều kiện chế tác", "Điều kiện Sử dụng"
  const colonIdx = line.indexOf(":");
  if (colonIdx > 0 && colonIdx <= 60) {
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    // Key must not contain comma (mid-sentence text)
    if (!/,/.test(key)) {
      if (val === "") return "subheader";
      if (/^(Tên|Cấp độ|Lớp nghề|Danh hiệu|Điểm Chỉ số)$/.test(key)) return "header";
      return "stat"; // all other key:value pairs → stat (val can be long text like descriptions)
    }
  }

  return "note";
}

function Block({ block, c, font, fs, lh=1.75, mob=false, itemNames=[] }) {
  if (block.type === "box") {
    // Merge lines bị ngắt giữa label và colon (vd: "Kỹ" + "Năng: value" → "Kỹ Năng: value")
    const rawLines = block.content.split("\n").map(l => l.trim()).filter(Boolean);
    console.log("BOX RAW:", JSON.stringify(rawLines));
    const mergedLines = [];
    for (let mi = 0; mi < rawLines.length; mi++) {
      const cur = rawLines[mi];
      const next = rawLines[mi + 1];
      // Case 1: fragment không có : + dòng sau có : → merge (vd: "Kỹ" + "Năng: value")
      // Không merge nếu cur là [section header]
      if (next && !cur.includes(":") && cur.length <= 30 && !/^\[.+\]$/.test(cur) && next.includes(":") && !next.startsWith("[")) {
        mergedLines.push(cur + " " + next);
        mi++;
      }
      // Case 2: [Section] riêng dòng + dòng sau là value → merge (vd: "[[Item] Rank]" + "Huyền thoại")
      else if (next && /^\[.+\]$/.test(cur) && !next.includes(":") && !/^\[/.test(next) && !/^\*/.test(next)) {
        mergedLines.push(cur + ": " + next);
        mi++;
      }
      // Case 3: "[Label]:" (colon nhưng không có val) + dòng sau là value → merge
      else if (next && /^\[.+\]:$/.test(cur.trim()) && !/^\[/.test(next) && !/^\*/.test(next)) {
        mergedLines.push(cur.trim() + " " + next);
        mi++;
      }
      // Case 4: label kết thúc bằng : nhưng không có val + dòng sau là tiếp theo của val
      else if (next && cur.endsWith(":") && !cur.startsWith("*") && cur.length <= 60 && !next.includes(":") && !/^\[/.test(next)) {
        mergedLines.push(cur + " " + next);
        mi++;
      }
      else {
        mergedLines.push(cur);
      }
    }
    const lines = mergedLines;
    const items = lines.map(line => ({ kind: classify(line), line }));

    // Group consecutive stats into statgroups
    const groups = [];
    let i = 0;
    while (i < items.length) {
      if (items[i].kind === "stat") {
        const batch = [];
        while (i < items.length && items[i].kind === "stat") { batch.push(items[i].line); i++; }
        groups.push({ kind: "statgroup", lines: batch });
      } else {
        groups.push(items[i]); i++;
      }
    }

    const ff = font.f;
    const allNotes = groups.every(g => g.kind === "note" || g.kind === "bullet");
    const boxFs = fs * 0.92;

    // iOS color tokens — adapt to current theme
    const isDark = c.bg === "#0E0E11";
    const isSepia = c.bg === "#F5EDD6";
    const iosBg    = c.s;
    const iosSep   = c.bd;
    const iosLabel = c.tx;
    const iosValue = c.tx;
    const iosNote  = c.tx2;
    const iosAccent = c.ac;

    // True iOS grouped table colors
    const iosCardBg = isDark ? "rgba(44,44,46,1)" : "#ffffff";
    const iosSepLine = isDark ? "rgba(84,84,88,0.65)" : "rgba(60,60,67,0.18)";

    return (
      <div style={{
        margin: "1.6em 0",
        borderRadius: 12,
        background: iosCardBg,
        overflow: "hidden",
        fontFamily: ff,
        border: `1px solid ${iosSepLine}`,
        boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.08), 0 2px 12px rgba(0,0,0,0.06)",
      }}>
        {(()=>{
          return groups.map((g, gi) => {
          const isFirst = gi === 0;
          const sep = isFirst ? "none" : `0.5px solid ${iosSepLine}`;

          /* ── SECTION: [Tên vật phẩm] ── */
          if (g.kind === "section") return (
            <div key={gi} style={{
              padding: "10px 16px",
              fontFamily: ff,
              fontWeight: 700,
              fontSize: boxFs * 0.97,
              color: iosValue,
              borderTop: sep,
              borderBottom: `0.5px solid ${iosSepLine}`,
            }}>
              {g.line}
            </div>
          );

          /* ── HEADER: Tên : Val ── */
          if (g.kind === "header") {
            const { label, val } = parseStat(g.line);
            return (
              <div key={gi} style={{
                padding: "11px 16px",
                fontFamily: ff,
                fontSize: boxFs,
                borderTop: sep,
                lineHeight: 1.5,
                minHeight: 44,
                display: "flex",
                alignItems: "flex-start",
              }}>
                <span style={{ fontWeight: 600, color: iosLabel, whiteSpace:"nowrap", flexShrink:0 }}>{sentenceCase(label)}</span>
                {val && <span style={{ fontWeight: 400, color: iosValue }}>: {sentenceCase(val)}</span>}
              </div>
            );
          }

          /* ── SUBHEADER (rank/type) ── */
          if (g.kind === "subheader") {
            const subLabel = g.line.replace(/:$/, "").trim();
            return (
              <div key={gi} style={{
                padding: "11px 16px",
                fontFamily: ff,
                fontWeight: 600,
                fontSize: boxFs,
                color: iosValue,
                borderTop: sep,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
              }}>
                {sentenceCase(subLabel)}
              </div>
            );
          }

          /* ── NOTE / BULLET ── */
          if (g.kind === "note" || g.kind === "bullet") {
            const prevG = groups[gi - 1];
            const nextG = groups[gi + 1];
            const seamlessPrev = prevG?.kind === "note" || prevG?.kind === "bullet";
            const seamlessNext = nextG?.kind === "note" || nextG?.kind === "bullet";
            return (
              <div key={gi} style={{
                fontFamily: ff,
                fontSize: boxFs,
                color: iosValue,
                lineHeight: 1.65,
                fontWeight: 400,
                background: "transparent",
                padding: seamlessPrev
                  ? (seamlessNext ? "0 16px" : "0 16px 11px")
                  : (seamlessNext ? "11px 16px 0" : "11px 16px"),
                borderTop: seamlessPrev ? "none" : sep,
              }}>
                {g.line}
              </div>
            );
          }

          /* ── STATGROUP ── */
          if (g.kind === "statgroup") {
            const stats = g.lines.map(parseStat);
            const rows = [];
            let j = 0;
            while (j < stats.length) {
              const s = stats[j];
              const isNumericVal = /^[\d,./ +~\-]+$/.test(s.val);
              const isLong = !isNumericVal && s.val.length > 30;
              if (isLong) {
                rows.push({ type: "long", stat: s });
              } else {
                rows.push({ type: "pair", stats: [s] });
              }
              j++;
            }
            const rows2 = [];
            let k = 0;
            while (k < rows.length) {
              if (rows[k].type === "pair" && k+1 < rows.length && rows[k+1].type === "pair") {
                rows2.push({ type: "pair2", stats: [rows[k].stats[0], rows[k+1].stats[0]] });
                k += 2;
              } else {
                rows2.push(rows[k]);
                k++;
              }
            }
            return (
              <div key={gi} style={{ borderTop: sep }}>
                {rows2.map((row, ri) => {
                  const rowSep = ri > 0 ? `0.5px solid ${iosSepLine}` : "none";
                  if (row.type === "long") {
                    const { label, val } = row.stat;
                    const labelLong = label.length > 20;
                    return (
                      <div key={ri} style={{
                        padding: "11px 16px",
                        fontFamily: ff,
                        fontSize: boxFs,
                        borderTop: rowSep,
                        lineHeight: 1.5,
                        minHeight: 44,
                        display: "flex",
                        alignItems: "flex-start",
                        flexDirection: (mob && labelLong) ? "column" : "row",
                        flexWrap: "wrap",
                        gap: (mob && labelLong) ? "2px 0" : "0 4px",
                      }}>
                        <span style={{ fontWeight: 600, color: iosLabel, whiteSpace: "nowrap", flexShrink: 0 }}>{sentenceCase(label)}{(mob && labelLong) ? "" : ":"}</span>
                        <span style={{ fontWeight: 400, color: iosValue }}>{(mob && labelLong) ? val : val}</span>
                      </div>
                    );
                  }
                  if (row.type === "pair2") {
                    return (
                      <div key={ri} style={{ display:"grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", borderTop: rowSep }}>
                        {row.stats.map((stat, si) => (
                          <div key={si} style={{
                            padding: "9px 16px",
                            fontFamily: ff,
                            fontSize: boxFs,
                            lineHeight: 1.6,
                            borderLeft: (!mob && si===1) ? `0.5px solid ${iosSepLine}` : "none",
                            display: "flex",
                            alignItems: "flex-start",
                          }}>
                            <span style={{ fontFamily:ff, fontWeight:700, color:iosLabel, whiteSpace:"nowrap", flexShrink:0 }}>{sentenceCase(stat.label)}</span>
                            <span style={{ fontFamily:ff, fontWeight:400, color:iosValue }}>{stat.val ? `: ${stat.val}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div key={ri} style={{ borderTop: rowSep }}>
                      {row.stats.map((stat, si) => (
                        <div key={si} style={{
                          padding: "11px 16px",
                          fontFamily: ff,
                          fontSize: boxFs,
                          lineHeight: 1.5,
                          minHeight: 44,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 0,
                        }}>
                          <span style={{ fontFamily:ff, fontWeight:600, color:iosLabel, whiteSpace:"nowrap", flexShrink:0 }}>{sentenceCase(stat.label)}</span>
                          <span style={{ fontFamily:ff, fontWeight:400, color:iosValue, fontVariantNumeric:"tabular-nums" }}>{stat.val ? `: ${stat.val}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          }

          return null;
        });
        })()}
      </div>
    );
  }


  const rawContent = /^<.+>$/.test(block.content.trim())
    ? `"${block.content.trim().slice(1,-1).trim()}"`
    : block.content;

  // Highlight tên vật phẩm/kỹ năng trong văn bản
  const renderWithBold = (text) => {
    if (!itemNames.length) return text;
    // Tạo regex từ tên, sort dài trước để match đúng
    const sorted = [...itemNames].sort((a,b)=>b.length-a.length);
    const escaped = sorted.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
    const re = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = text.split(re);
    if (parts.length===1) return text;
    return parts.map((part, i) =>
      sorted.some(n=>n.toLowerCase()===part.toLowerCase())
        ? <strong key={i} style={{fontWeight:700}}>{part}</strong>
        : part
    );
  };

  return (
    <p style={{
      marginBottom: "0.9em",
      fontFamily: font.f,
      fontSize: fs,
      lineHeight: lh,
      color: c.tx,
      textAlign: "left",
      overflowWrap: "break-word",
      wordBreak: "break-word",
    }}>
      {renderWithBold(rawContent)}
    </p>
  );
}

// Global chapter cache — dùng ngoài component để addChapters có thể clear
const globalChapterCache = { current: {} };

// localStorage helpers
const lsGet = (key, fallback) => { try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; } };
const lsSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// -- MAIN --
export default function App() {
  const [pg, setPg]          = useState("home");
  const [chapterId, setChId] = useState(null);
  const [chapters, setChaps] = useState(INITIAL_CHAPTERS);
  const [theme, setTheme]    = useState(()=>lsGet("theme","light"));
  const [fs, setFs]          = useState(()=>lsGet("fs",18));
  const [fi, setFi]          = useState(()=>lsGet("fi",0));
  const [lh, setLh]          = useState(()=>lsGet("lh",1.75));
  const [cw, setCw]          = useState(()=>lsGet("cw",660));
  const [bookmark, setBookmark] = useState(()=>lsGet("bookmark",null));
  const [scrollPos, setScrollPos] = useState(()=>lsGet("scrollPos",{}));
  const [lastRead, setLastRead] = useState(()=>lsGet("lastRead",null));
  const [sett, setSett]      = useState(false);
  const [toc,  setToc]       = useState(false);
  const [toast, setToast]    = useState(null);

  // Persist to localStorage khi thay đổi
  useEffect(()=>lsSet("theme",theme),[theme]);
  useEffect(()=>lsSet("fs",fs),[fs]);
  useEffect(()=>lsSet("fi",fi),[fi]);
  useEffect(()=>lsSet("lh",lh),[lh]);
  useEffect(()=>lsSet("cw",cw),[cw]);
  useEffect(()=>lsSet("bookmark",bookmark),[bookmark]);
  useEffect(()=>lsSet("scrollPos",scrollPos),[scrollPos]);
  useEffect(()=>lsSet("lastRead",lastRead),[lastRead]);

  // Sync progress lên Supabase (debounce 2s để không spam)
  const syncTimer = useRef(null);
  useEffect(()=>{
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(()=>{
      sbSaveProgress({
        last_read: lastRead,
        bookmark,
        scroll_pos: scrollPos,
        settings: {theme, fs, fi, lh, cw}
      });
    }, 2000);
  }, [lastRead, bookmark, scrollPos, theme, fs, fi, lh, cw]);

  // Load progress từ Supabase khi mở app — ưu tiên cloud hơn localStorage
  useEffect(()=>{
    sbLoadProgress().then(data=>{
      if(!data) return;
      if(data.last_read)  { setLastRead(data.last_read);  lsSet("lastRead", data.last_read); }
      if(data.bookmark)   { setBookmark(data.bookmark);   lsSet("bookmark", data.bookmark); }
      if(data.scroll_pos) { setScrollPos(data.scroll_pos); lsSet("scrollPos", data.scroll_pos); }
      if(data.settings) {
        const s = data.settings;
        if(s.theme) { setTheme(s.theme); lsSet("theme", s.theme); }
        if(s.fs)    { setFs(s.fs);       lsSet("fs", s.fs); }
        if(s.fi!=null){ setFi(s.fi);     lsSet("fi", s.fi); }
        if(s.lh)    { setLh(s.lh);       lsSet("lh", s.lh); }
        if(s.cw)    { setCw(s.cw);       lsSet("cw", s.cw); }
      }
    });
  }, []);

  const c = themes[theme];
  const restoreScrollRef = useRef(false);
  const goRead = id => { restoreScrollRef.current = true; setChId(id); setPg("read"); setSett(false); setToc(false); setLastRead(id); };
  // FIX 2: nav("upload") directly via state — no getElementById needed
  const nav    = p  => { setPg(p);   setSett(false); setToc(false); };
  const flash  = (m, color="#16a34a") => { setToast({m,color}); setTimeout(()=>setToast(null),3000); };
  const nextTheme = () => setTheme(t => t==="light"?"dark":t==="dark"?"sepia":"light");

  const addChapters = newChaps => {
    // Clear cache + delete existing then save
    newChaps.forEach(async ch => {
      delete globalChapterCache.current[ch.id]; // xóa cache cũ
      await sbDelete(ch.id);
      await sbSave(ch);
    });
    setChaps(prev => {
      const newIds = new Set(newChaps.map(c=>c.id));
      const kept = prev.filter(c=>!newIds.has(c.id));
      return [...kept, ...newChaps].sort((a,b)=>a.id-b.id);
    });
  };
  const deleteChapter = id => { sbDelete(id); setChaps(prev=>prev.filter(c=>c.id!==id)); };
  const deleteAllChapters = () => { chapters.forEach(c=>sbDelete(c.id)); setChaps([]); };

  // Load from Supabase on mount
  useEffect(()=>{
    sbLoad().then(data => {
      if (data && data.length > 0) {
        // Merge: giữ paragraphs nếu đã có trong memory (INITIAL_CHAPTERS)
        setChaps(prev => {
          const localMap = new Map(prev.map(c=>[c.id,c]));
          const merged = data.map(ch => localMap.has(ch.id) && localMap.get(ch.id).paragraphs
            ? localMap.get(ch.id)  // giữ bản có paragraphs
            : ch                   // dùng metadata từ cloud
          );
          return merged;
        });
        flash(`☁️ Đã tải ${data.length} chương từ cloud`);
        // Auto-navigate đến chương đang đọc
        const lr = lsGet("lastRead", null);
        if (lr) {
          restoreScrollRef.current = true;
          setChId(lr);
          setPg("read");
        }
      }
    });
  }, []);

  useEffect(()=>{ if(pg==="home") window.scrollTo({top:0}); },[pg]);

  // Inject Google Fonts link dynamically (more reliable than @import in style tag)
  useEffect(()=>{
    const id = 'gf-novel-reader';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:ital,wght@0,300;0,400;0,600;1,400&display=swap';
    document.head.appendChild(link);
  }, []);

  const idx  = chapters.findIndex(ch=>ch.id===chapterId);
  const prev = idx > 0 ? chapters[idx-1] : null;
  const next = idx < chapters.length-1 ? chapters[idx+1] : null;

  return <>
    {/* FIX 3: Added italic weights for Lora and Source Sans 3 */}
    <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet"/>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:ital,wght@0,300;0,400;0,600;1,400&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{overflow-x:hidden;font-family:Arial,sans-serif}
      div,span,p,button,input{font-family:inherit}
      input:focus{outline:none}
      @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @keyframes pop{from{opacity:0;transform:translateY(-8px) translateX(-50%)}to{opacity:1;transform:translateY(0) translateX(-50%)}}
      @keyframes chFadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @keyframes settFade{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes overlayIn{from{opacity:0}to{opacity:1}}
      .au{animation:fadeUp .35s ease both} .d1{animation-delay:.05s}
      .ch-content{animation:chFadeIn .3s cubic-bezier(.22,1,.36,1) both}
      .ios-row{transition:background .12s ease}
      .ios-row:active{background:rgba(0,0,0,0.04)!important}
      ::-webkit-scrollbar{width:16px}::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:${c.tx3};border-radius:9px;border:2px solid transparent;background-clip:padding-box}
      ::selection{background:${c.ac}28}
    
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  img, video { max-width: 100%; }
  @media (max-width: 640px) {
    .au { padding-left: 12px !important; padding-right: 12px !important; }
    .d1 { flex-wrap: nowrap !important; overflow-x: auto !important; }
  }`}</style>

    <div style={{minHeight:"100vh",background:c.bg,color:c.tx,fontFamily:FONTS[fi].f,transition:"background .3s,color .3s"}}>

      {pg!=="read" && <nav style={{position:"sticky",top:0,zIndex:100,background:c.nav,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:`1px solid ${c.bd}`}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 12px",height:54,display:"grid",gridTemplateColumns:"auto 1fr auto",alignItems:"center",gap:8}}>

          {/* Cột trái: logo */}
          <div style={{display:"flex",alignItems:"center"}}>
            <div onClick={()=>nav("home")} style={{width:38,height:38,borderRadius:8,background:"linear-gradient(135deg,#1a1a2e,#0f3460)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
              <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
                <g transform="translate(20,20) rotate(-42) translate(-20,-20)">
                  <rect x="18.5" y="13" width="3" height="17" rx="1.2" fill="#C9A027"/>
                  <rect x="12" y="6" width="16" height="9" rx="2" fill="#CCCCCC"/>
                  <rect x="12" y="6" width="16" height="3" rx="1.5" fill="#EEEEEE" opacity="0.5"/>
                </g>
                <g transform="translate(20,20) rotate(42) translate(-20,-20)">
                  <rect x="18.5" y="13" width="3" height="17" rx="1.2" fill="#C9A027"/>
                  <rect x="12" y="6" width="16" height="9" rx="2" fill="#CCCCCC"/>
                  <rect x="12" y="6" width="16" height="3" rx="1.5" fill="#EEEEEE" opacity="0.5"/>
                </g>
                <circle cx="20" cy="20" r="3" fill="#FF6B35" opacity="0.9"/>
                <circle cx="20" cy="20" r="1.5" fill="#FFD700"/>
              </svg>
            </div>
          </div>

          {/* Cột giữa: trống */}
          <div/>

          {/* Cột phải: Đăng truyện + theme */}
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"flex-end"}}>
            <button onClick={()=>nav("upload")} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 13px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:pg==="upload"?600:400,fontFamily:"Arial,sans-serif",background:pg==="upload"?c.acBg:"transparent",color:pg==="upload"?c.ac:c.tx2,transition:"all .2s"}}>
              <I.Upload/> Đăng truyện
            </button>
            <button onClick={nextTheme} style={{width:32,height:32,borderRadius:7,border:`1px solid ${c.bd}`,background:c.s,color:c.tx2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {theme==="dark"?<I.Sun/>:<I.Moon/>}
            </button>
          </div>

        </div>
      </nav>}

      {toast&&<div style={{position:"fixed",top:64,left:"50%",zIndex:200,background:toast.color,color:"#fff",padding:"8px 20px",borderRadius:9,fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:6,boxShadow:`0 6px 20px ${toast.color}50`,animation:"pop .3s ease",whiteSpace:"nowrap"}}><I.Check/> {toast.m}</div>}

      <main style={{maxWidth:pg==="read"?"100%":900,margin:"0 auto",padding:pg==="read"?"0":"0 16px"}}>
        {pg==="home"   && <Home   c={c} chapters={chapters} goRead={goRead} navUpload={()=>nav("upload")} bookmark={bookmark} goBookmark={()=>bookmark&&goRead(bookmark)} lastRead={lastRead} scrollPos={scrollPos}/>}
        {pg==="read"   && <Read   c={c} chapters={chapters} chapterId={chapterId} setChId={setChId} restoreScrollRef={restoreScrollRef} fs={fs} setFs={setFs} fi={fi} setFi={setFi} lh={lh} setLh={setLh} cw={cw} setCw={setCw} bookmark={bookmark} setBookmark={setBookmark} scrollPos={scrollPos} setScrollPos={setScrollPos} lastRead={lastRead} setLastRead={setLastRead} sett={sett} setSett={setSett} toc={toc} setToc={setToc} theme={theme} setTheme={setTheme} prev={prev} next={next} idx={idx} nextTheme={nextTheme} navHome={()=>nav("home")}/>}
        {pg==="upload" && <Upload c={c} chapters={chapters} addChapters={addChapters} deleteChapter={deleteChapter} deleteAllChapters={deleteAllChapters} flash={flash} theme={theme} nextTheme={nextTheme}/>}
      </main>
    </div>
  </>;
}

// -- HOME -- FIX 2: receives navUpload prop instead of using getElementById
function Home({c,chapters,goRead,navUpload,bookmark,goBookmark,lastRead,scrollPos}){
  const mob = useIsMobile();
  const [tab,setTab]=useState("about");
  const [exp,setExp]=useState(false);
  return(
    <div style={{paddingBottom:60}}>
      <div className="au" style={{display:"flex",gap:16,padding:"24px 0 20px",alignItems:"flex-start",flexWrap: mob ? "wrap" : "nowrap"}}>
        {/* Cover */}
        <div style={{width: mob ? "100%" : "min(280px,45vw)",flexShrink:0,borderRadius:10,boxShadow:"0 6px 24px rgba(0,0,0,0.18)",overflow:"hidden"}}>
          <img src="data:image/jpeg;base64,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" alt="cover" style={{width:"100%",height:"auto",display:"block",objectFit:"cover"}}/>
        </div>

        {/* Meta */}
        <div style={{flex:1,minWidth:260,paddingTop:2}}>
          <h1 style={{fontSize:30,fontWeight:800,letterSpacing:"-0.02em",lineHeight:1.2,marginBottom:10,fontFamily:"Arial,sans-serif"}}>{NOVEL_META.title}</h1>
          <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:800,letterSpacing:"0.08em",background:`linear-gradient(135deg, #22c55e22, #16a34a18)`,border:`1.5px solid #22c55e`,color:"#16a34a",marginBottom:12,boxShadow:"0 1px 4px #22c55e28"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",display:"inline-block",boxShadow:"0 0 0 2px #22c55e44"}}/>
            COMPLETED
          </span>
          <div style={{marginBottom:14,lineHeight:1.8,fontSize:14}}>
            <div><span style={{color:c.tx,fontWeight:500}}>Tác giả: </span><span style={{fontWeight:600,color:c.tx}}>{NOVEL_META.author}</span></div>
            <div><span style={{color:c.tx,fontWeight:500}}>Dịch giả: </span><span style={{fontWeight:600,color:c.tx}}>{NOVEL_META.translator}</span></div>
            <div><span style={{color:c.tx,fontWeight:500}}>Số chương: </span><span style={{fontWeight:600,color:c.tx}}>{chapters.length}</span></div>
          </div>
          <div style={{marginBottom:18}}>
            <p style={{fontSize:14,lineHeight:1.75,color:c.tx,display:"-webkit-box",WebkitLineClamp:exp?999:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{NOVEL_META.desc}</p>
            <button onClick={()=>setExp(!exp)} style={{background:"none",border:"none",cursor:"pointer",color:c.tx2,fontSize:13,fontWeight:600,padding:"4px 0 0",display:"flex",alignItems:"center",gap:3,fontFamily:"Arial,sans-serif"}}>
              {exp?"Thu gọn":"Xem thêm"} {exp?<I.UpArr/>:<I.Down/>}
            </button>
          </div>

          {chapters.length > 0 ? (
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>goRead(chapters[0].id)}
                style={{padding:"10px 20px",borderRadius:10,border:`1.5px solid ${c.bd}`,cursor:"pointer",background:"#fff",color:"#111",fontSize:13,fontWeight:600,fontFamily:"Arial,sans-serif",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:7,whiteSpace:"nowrap"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=c.ac;e.currentTarget.style.boxShadow=`0 4px 14px ${c.ac}30`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=c.bd;e.currentTarget.style.boxShadow="";}}>
                ▷ Đọc từ đầu
              </button>
              {lastRead&&(()=>{
                const ch = chapters.find(c=>c.id===lastRead);
                return ch ? (
                  <button onClick={()=>goRead(lastRead)}
                    style={{padding:"10px 20px",borderRadius:10,border:`1.5px solid ${c.bd}`,cursor:"pointer",background:"#fff",color:"#111",fontSize:13,fontWeight:600,fontFamily:"Arial,sans-serif",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:7,whiteSpace:"nowrap"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=c.ac;e.currentTarget.style.boxShadow=`0 4px 14px ${c.ac}30`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=c.bd;e.currentTarget.style.boxShadow="";}}>
                    <span style={{fontWeight:600,fontSize:13}}>▷ Tiếp tục đọc</span>
                  </button>
                ) : null;
              })()}
              {bookmark&&bookmark!==lastRead&&<button onClick={goBookmark}
                style={{padding:"12px 20px",borderRadius:9,border:`1.5px solid ${c.bd}`,cursor:"pointer",background:"transparent",color:c.tx2,fontSize:14,fontWeight:600,fontFamily:"Arial,sans-serif",transition:"all .2s",display:"flex",alignItems:"center",gap:7}}>
                🔖 Bookmark
              </button>}
            </div>
          ) : (
            // FIX 2: use navUpload prop — no more getElementById hack
            <button onClick={navUpload}
              style={{padding:"12px 32px",borderRadius:9,border:`1.5px dashed ${c.bd}`,cursor:"pointer",background:"transparent",color:c.tx2,fontSize:14,fontWeight:600,fontFamily:"Arial,sans-serif",transition:"all .2s"}}>
              + Upload chương đầu tiên
            </button>
          )}
        </div>
      </div>

      <div style={{height:1,background:c.bd}}/>

      <div className="au" style={{padding:"20px 0"}}>
        {chapters.length===0?(
          <div style={{textAlign:"center",padding:"48px 0",color:c.tx3}}>
            <div style={{fontSize:36,marginBottom:12}}>📂</div>
            <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>Chưa có chương nào</div>
            <div style={{fontSize:13}}>Vào "Đăng truyện" để upload file .docx</div>
          </div>
        ):(
          <>
            <div style={{fontSize:13,fontWeight:700,color:c.tx,marginBottom:10}}>Danh sách chương</div>
            <div style={{display:"grid",gridTemplateColumns: mob ? "1fr" : "1fr 1fr",gap: mob ? "6px" : "6px 48px"}}>
              {chapters.map((ch,i)=>(
                <button key={ch.id} onClick={()=>goRead(ch.id)}
                  style={{display:"flex",alignItems:"center",padding:"11px 14px",borderRadius:8,border:`1px solid ${c.bd}`,background:c.s,color:c.tx,fontSize:13,cursor:"pointer",fontFamily:"Arial,sans-serif",textAlign:"left",transition:"all .15s",gap:10,minWidth:0}}
                  onMouseEnter={e=>{e.currentTarget.style.background=c.hv;e.currentTarget.style.borderColor=c.ac+"50";}}
                  onMouseLeave={e=>{e.currentTarget.style.background=c.s;e.currentTarget.style.borderColor=c.bd;}}>
                  <span style={{color:c.tx3,fontSize:11,minWidth:28,fontWeight:600,flexShrink:0}}>#{i+1}</span>
                  <span style={{flex:1,fontWeight:600,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{bookmark===ch.id&&<span style={{color:c.ac,marginRight:4,fontSize:12}}>🔖</span>}{ch.title}</span>
                  <I.R/>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Virtual scroll list — chỉ render rows trong viewport, dùng cho 3k+ chương
function VirtualList({ items, itemHeight=36, renderItem, containerStyle={} }){
  const ref = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewHeight, setViewHeight] = useState(400);
  useEffect(()=>{
    const el = ref.current;
    if(!el) return;
    setViewHeight(el.clientHeight);
    const onScroll = ()=>setScrollTop(el.scrollTop);
    const onResize = ()=>setViewHeight(el.clientHeight);
    el.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onResize);
    return ()=>{ el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  },[]);
  const totalHeight = items.length * itemHeight;
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - 3);
  const endIdx   = Math.min(items.length, Math.ceil((scrollTop + viewHeight) / itemHeight) + 3);
  const visible  = items.slice(startIdx, endIdx);
  return(
    <div ref={ref} style={{overflowY:'auto', position:'relative', ...containerStyle}}>
      <div style={{height:totalHeight, position:'relative'}}>
        <div style={{position:'absolute', top: startIdx * itemHeight, left:0, right:0}}>
          {visible.map((item,i)=>(
            <div key={item.id ?? (startIdx+i)} style={{height:itemHeight, boxSizing:'border-box'}}>
              {renderItem(item, startIdx+i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- READ --
function Read({c,chapters,chapterId,setChId,fs,setFs,fi,setFi,lh,setLh,cw,setCw,bookmark,setBookmark,scrollPos,setScrollPos,lastRead,setLastRead,sett,setSett,toc,setToc,theme,setTheme,prev,next,idx,nextTheme,navHome,restoreScrollRef={current:false}}){
  const mob    = useIsMobile();
  const [mobMenu, setMobMenu] = useState(false);
  const [tocSearch, setTocSearch] = useState('');
  const [tocSearchDebounced, setTocSearchDebounced] = useState('');
  const tocSearchTimer = useRef(null);
  const handleTocSearch = useCallback(v=>{
    setTocSearch(v);
    clearTimeout(tocSearchTimer.current);
    tocSearchTimer.current = setTimeout(()=>setTocSearchDebounced(v), 200);
  },[]);
  const filteredChapters = useMemo(()=>{
    if(!tocSearchDebounced) return chapters;
    const q = tocSearchDebounced.toLowerCase();
    return chapters.filter(ch=>ch.title.toLowerCase().includes(q));
  },[chapters, tocSearchDebounced]);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(()=>{
    const onScroll = () => {
      const y = window.scrollY;
      if(y < 60) { setHeaderVisible(true); }
      else if(y > lastScrollY.current + 8) { setHeaderVisible(false); setSett(false); setToc(false); }
      else if(y < lastScrollY.current - 8) { setHeaderVisible(true); }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, {passive:true});
    return ()=>window.removeEventListener('scroll', onScroll);
  }, []);

  // Track lastRead
  useEffect(()=>{ if(chapterId) setLastRead(chapterId); },[chapterId]);

  // Save scroll position when leaving chapter
  useEffect(()=>{
    const saveScroll = () => {
      if(chapterId) setScrollPos(prev=>({...prev, [chapterId]: window.scrollY}));
    };
    window.addEventListener('scroll', saveScroll, {passive:true});
    return ()=> window.removeEventListener('scroll', saveScroll);
  }, [chapterId]);

  const pendingScroll = useRef(null);

  // Khi chapterId đổi: set pending scroll
  useEffect(()=>{
    if(!chapterId) return;
    if(restoreScrollRef.current) {
      const saved = scrollPos[chapterId];
      pendingScroll.current = (saved && saved > 100) ? saved : 0;
      restoreScrollRef.current = false;
    } else {
      pendingScroll.current = 0;
    }
  }, [chapterId]);
  const font   = FONTS[fi];
  const chMeta = chapters.find(ch=>ch.id===chapterId);
  const [chData, setChDataLocal] = useState(null);

  // Cache chương đã load — tránh fetch lại
  const chapterCache = globalChapterCache;

  // Lazy load paragraphs khi chapterId thay đổi
  useEffect(()=>{
    if(!chapterId) return;
    setChDataLocal(null);
    // Kiểm tra cache trước
    if(chapterCache.current[chapterId]){
      setChDataLocal(chapterCache.current[chapterId]);
      setTimeout(()=>{
        if(pendingScroll.current !== null){
          window.scrollTo({top: pendingScroll.current});
          pendingScroll.current = null;
        }
      }, 80);
      return;
    }
    // Nếu đã có paragraphs trong memory (vừa upload) thì dùng luôn
    const cached = chapters.find(ch=>ch.id===chapterId);
    if(cached?.paragraphs?.length){
      chapterCache.current[chapterId] = cached;
      setChDataLocal(cached);
      setTimeout(()=>{
        if(pendingScroll.current !== null){
          window.scrollTo({top: pendingScroll.current});
          pendingScroll.current = null;
        }
      }, 80);
      return;
    }
    // Không có thì fetch từ Supabase
    sbLoadOne(chapterId).then(data=>{
      if(data){
        chapterCache.current[chapterId] = data;
        setChDataLocal(data);
        setTimeout(()=>{
          if(pendingScroll.current !== null){
            window.scrollTo({top: pendingScroll.current});
            pendingScroll.current = null;
          }
        }, 80);
      }
    });
  },[chapterId]);

  // Prefetch chương kế tiếp và trước
  useEffect(()=>{
    const prefetch = (id) => {
      if(!id || chapterCache.current[id]) return;
      const mem = chapters.find(ch=>ch.id===id);
      if(mem?.paragraphs?.length){ chapterCache.current[id]=mem; return; }
      sbLoadOne(id).then(data=>{ if(data) chapterCache.current[id]=data; });
    };
    if(next) prefetch(next.id);
    if(prev) prefetch(prev.id);
  },[chapterId, next, prev]);

  // Keyboard ← → navigation
  useEffect(()=>{
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" && next) { setChId(next.id); window.scrollTo({top:0}); }
      if (e.key === "ArrowLeft"  && prev) { setChId(prev.id); window.scrollTo({top:0}); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, setChId]);

  if(!chMeta) return(
    <div style={{textAlign:"center",padding:"80px 0",color:c.tx3}}>
      <div style={{fontSize:36,marginBottom:12}}>📖</div>
      <div style={{fontWeight:600}}>Chọn chương để bắt đầu đọc</div>
    </div>
  );

  if(!chData) return(
    <div style={{textAlign:"center",padding:"80px 0",color:c.tx3}}>
      <div style={{fontSize:32,marginBottom:12,animation:"spin 1s linear infinite",display:"inline-block"}}>⏳</div>
      <div style={{fontWeight:600}}>Đang tải chương...</div>
    </div>
  );

  return(
    <div style={{paddingBottom:mob?100:80}}>

      {/* -- READING HEADER -- */}
      <div style={{position:"sticky",top:0,zIndex:100,background:c.nav,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",display:"flex",alignItems:"center",padding:"0 24px",height:54,borderBottom:`1px solid ${c.bd}`,gap:8,transform:headerVisible?"translateY(0)":"translateY(-100%)",transition:"transform .25s ease"}}>
        {/* Trái: logo + tên truyện */}
        <div onClick={navHome} style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,cursor:"pointer"}}>
          <div style={{width:32,height:32,borderRadius:7,background:"linear-gradient(135deg,#1a1a2e,#0f3460)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
              <g transform="translate(20,20) rotate(-42) translate(-20,-20)">
                <rect x="18.5" y="13" width="3" height="17" rx="1.2" fill="#C9A027"/>
                <rect x="12" y="6" width="16" height="9" rx="2" fill="#CCCCCC"/>
                <rect x="12" y="6" width="16" height="3" rx="1.5" fill="#EEEEEE" opacity="0.5"/>
              </g>
              <g transform="translate(20,20) rotate(42) translate(-20,-20)">
                <rect x="18.5" y="13" width="3" height="17" rx="1.2" fill="#C9A027"/>
                <rect x="12" y="6" width="16" height="9" rx="2" fill="#CCCCCC"/>
                <rect x="12" y="6" width="16" height="3" rx="1.5" fill="#EEEEEE" opacity="0.5"/>
              </g>
              <circle cx="20" cy="20" r="3" fill="#FF6B35" opacity="0.9"/>
              <circle cx="20" cy="20" r="1.5" fill="#FFD700"/>
            </svg>
          </div>
          <span style={{fontSize:14,fontWeight:800,color:c.tx,whiteSpace:"nowrap",letterSpacing:"-0.02em"}}>{NOVEL_META.title}</span>
        </div>

        {/* Phân cách - đã xóa */}

        {/* Tên chương - giữa */}
        <div style={{flex:1,fontSize:14,fontWeight:700,color:c.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center"}}>
          {chMeta.title}
        </div>

        {mob ? (
          <button onClick={()=>setMobMenu(true)}
            style={{width:36,height:36,borderRadius:8,border:`1px solid ${c.bd}`,background:c.s,color:c.tx,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,flexShrink:0}}>
            ⋯
          </button>
        ) : (
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,position:"relative"}}>
            <div style={{position:"relative"}}>
              <button onClick={()=>{setToc(!toc);setSett(false);}}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:7,border:`1px solid ${toc?c.ac:c.bd}`,background:toc?c.acBg:c.s,color:toc?c.ac:c.tx,fontSize:12.5,fontWeight:600,fontFamily:"Arial,sans-serif",cursor:"pointer",transition:"all .2s"}}>
                <I.List/> Mục lục
              </button>
              {toc&&(
                <div className="au" style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:50,background:c.s,borderRadius:10,padding:10,border:`1px solid ${c.bd}`,boxShadow:c.sh,width:260,maxHeight:380,display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
                  <input autoFocus placeholder="🔍 Tìm chương..." value={tocSearch} onChange={e=>handleTocSearch(e.target.value)}
                    style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${c.ac}`,background:c.bg,color:c.tx,fontSize:12,fontFamily:"Arial,sans-serif",marginBottom:6,outline:"none"}}
                  />
                  <div style={{fontSize:10,fontWeight:700,color:c.tx3,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em",paddingLeft:2}}>{chapters.length} chương</div>
                  {tocSearchDebounced&&filteredChapters.length===0&&(
                    <div style={{textAlign:"center",padding:"12px 0",color:c.tx3,fontSize:12}}>Không tìm thấy</div>
                  )}
                  <VirtualList
                    items={filteredChapters}
                    itemHeight={34}
                    containerStyle={{flex:1,minHeight:0,maxHeight:300}}
                    renderItem={ch=>(
                      <button onClick={()=>{setChId(ch.id);setToc(false);setTocSearch('');setTocSearchDebounced('');window.scrollTo({top:0});}}
                        style={{width:"100%",height:34,padding:"0 10px",borderRadius:6,textAlign:"left",border:"none",background:chapterId===ch.id?c.acBg:"transparent",color:chapterId===ch.id?c.ac:c.tx,fontSize:12.5,fontWeight:chapterId===ch.id?600:400,fontFamily:"Arial,sans-serif",cursor:"pointer",lineHeight:1.4,display:"flex",alignItems:"center",boxSizing:"border-box",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}
                        onMouseEnter={e=>{if(chapterId!==ch.id)e.currentTarget.style.background=c.hv;}}
                        onMouseLeave={e=>{if(chapterId!==ch.id)e.currentTarget.style.background="transparent";}}>
                        {bookmark===ch.id && <span style={{color:c.ac,marginRight:4}}>🔖</span>}{ch.title}
                      </button>
                    )}
                  />
                </div>
              )}
            </div>
            <div style={{position:"relative"}}>
              <button onClick={()=>{setSett(!sett);setToc(false);}}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:7,border:`1px solid ${sett?c.ac:c.bd}`,background:sett?c.acBg:c.s,color:sett?c.ac:c.tx,fontSize:12.5,fontWeight:600,fontFamily:"Arial,sans-serif",cursor:"pointer",transition:"all .2s"}}>
                <I.Gear/> Cài đặt
              </button>
              {sett&&(
                <div className="au" onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 10px)",right:0,zIndex:50,width:300,animation:"settFade .2s cubic-bezier(.34,1.56,.64,1) both"}}>
                  {/* iOS-style grouped settings */}
                  <div style={{background:theme==="dark"?"rgba(28,28,30,0.95)":"rgba(255,255,255,0.95)",backdropFilter:"blur(40px)",WebkitBackdropFilter:"blur(40px)",borderRadius:16,overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,0.18),0 0 0 0.5px rgba(0,0,0,0.08)"}}>
                    {/* Giao diện */}
                    <div style={{padding:"14px 16px 10px"}}>
                      <div style={{fontSize:11,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Giao diện</div>
                      <div style={{display:"flex",gap:6,background:theme==="dark"?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)",borderRadius:10,padding:3}}>
                        {[{id:"light",lb:"☀️ Sáng"},{id:"dark",lb:"🌙 Tối"},{id:"sepia",lb:"📜 Sepia"}].map(m=>(
                          <button key={m.id} onClick={()=>setTheme(m.id)} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",background:theme===m.id?(theme==="dark"?"rgba(255,255,255,0.15)":"#fff"):"transparent",color:theme===m.id?c.tx:c.tx2,fontSize:11.5,fontWeight:theme===m.id?700:500,cursor:"pointer",transition:"all .18s",boxShadow:theme===m.id?"0 1px 4px rgba(0,0,0,0.12)":"none"}}>{m.lb}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{height:"0.5px",background:theme==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",margin:"0 16px"}}/>
                    {/* Cỡ chữ */}
                    <div style={{padding:"12px 16px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontSize:11,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.06em"}}>Cỡ chữ</div>
                        <div style={{fontSize:13,fontWeight:700,color:c.ac,background:c.acBg,padding:"2px 10px",borderRadius:20}}>{fs}px</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <button onClick={()=>setFs(Math.max(14,fs-1))} style={{width:32,height:32,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx,fontSize:16,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>−</button>
                        <div style={{flex:1,position:"relative",height:4,borderRadius:4,background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}}>
                          <div style={{position:"absolute",left:0,top:0,height:"100%",borderRadius:4,background:c.ac,width:`${((fs-14)/14)*100}%`,transition:"width .15s"}}/>
                          <input type="range" min="14" max="28" value={fs} onChange={e=>setFs(+e.target.value)} style={{position:"absolute",left:0,top:-8,width:"100%",height:20,opacity:0,cursor:"pointer"}}/>
                        </div>
                        <button onClick={()=>setFs(Math.min(28,fs+1))} style={{width:32,height:32,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx,fontSize:16,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>+</button>
                      </div>
                    </div>
                    <div style={{height:"0.5px",background:theme==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",margin:"0 16px"}}/>
                    {/* Phông chữ */}
                    <div style={{padding:"12px 16px"}}>
                      <div style={{fontSize:11,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Phông chữ</div>
                      <div style={{display:"flex",flexDirection:"column",gap:2}}>
                        {FONTS.map((f,i)=>(
                          <button key={f.n} onClick={()=>setFi(i)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",borderRadius:10,border:"none",background:fi===i?(theme==="dark"?"rgba(59,130,246,0.15)":"rgba(59,130,246,0.08)"):"transparent",color:fi===i?c.ac:c.tx,fontSize:13,fontFamily:f.f,cursor:"pointer",transition:"all .15s",textAlign:"left"}}>
                            <span style={{fontWeight:fi===i?700:400}}>{f.n}</span>
                            {fi===i&&<span style={{fontSize:16}}>✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{height:"0.5px",background:theme==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",margin:"0 16px"}}/>
                    {/* Độ rộng */}
                    <div style={{padding:"12px 16px 14px"}}>
                      <div style={{fontSize:11,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Độ rộng</div>
                      <div style={{display:"flex",gap:6,background:theme==="dark"?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)",borderRadius:10,padding:3}}>
                        {[{lb:"Hẹp",v:500},{lb:"Vừa",v:660},{lb:"Rộng",v:860},{lb:"Full",v:9999}].map(o=>(
                          <button key={o.v} onClick={()=>setCw(o.v)} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",background:cw===o.v?(theme==="dark"?"rgba(255,255,255,0.15)":"#fff"):"transparent",color:cw===o.v?c.tx:c.tx2,fontSize:11.5,fontWeight:cw===o.v?700:500,cursor:"pointer",transition:"all .18s",boxShadow:cw===o.v?"0 1px 4px rgba(0,0,0,0.12)":"none"}}>{o.lb}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{height:"0.5px",background:theme==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",margin:"0 16px"}}/>
                    {/* Dãn dòng */}
                    <div style={{padding:"12px 16px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontSize:11,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.06em"}}>Dãn dòng</div>
                        <div style={{fontSize:13,fontWeight:700,color:c.ac,background:c.acBg,padding:"2px 10px",borderRadius:20}}>{lh.toFixed(2)}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <button onClick={()=>setLh(l=>Math.max(1.4,+(l-0.1).toFixed(1)))} style={{width:32,height:32,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx,fontSize:16,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>−</button>
                        <div style={{flex:1,position:"relative",height:4,borderRadius:4,background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}}>
                          <div style={{position:"absolute",left:0,top:0,height:"100%",borderRadius:4,background:c.ac,width:`${((lh-1.4)/1.2)*100}%`,transition:"width .15s"}}/>
                          <input type="range" min="1.4" max="2.6" step="0.1" value={lh} onChange={e=>setLh(+e.target.value)} style={{position:"absolute",left:0,top:-8,width:"100%",height:20,opacity:0,cursor:"pointer"}}/>
                        </div>
                        <button onClick={()=>setLh(l=>Math.min(2.6,+(l+0.1).toFixed(1)))} style={{width:32,height:32,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx,fontSize:16,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM SHEET ── */}
      {mob && mobMenu && (
        <>
          <div onClick={()=>setMobMenu(false)} style={{position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,0.5)",animation:"overlayIn .2s ease"}}/>
          <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:theme==="dark"?"rgba(28,28,30,0.97)":"rgba(255,255,255,0.97)",backdropFilter:"blur(40px)",WebkitBackdropFilter:"blur(40px)",borderRadius:"20px 20px 0 0",padding:"0 0 env(safe-area-inset-bottom,20px)",boxShadow:"0 -2px 40px rgba(0,0,0,0.2)",animation:"sheetUp .32s cubic-bezier(.32,1,.23,1) both"}}>
            {/* Handle bar + close */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px 6px"}}>
              <div style={{width:36,height:4,borderRadius:2,background:c.bd,margin:"0 auto"}}/>
              <button onClick={()=>setMobMenu(false)} style={{position:"absolute",right:16,top:10,width:28,height:28,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx2,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>
            </div>
            {/* Chapter title */}
            <div style={{padding:"4px 20px 12px",borderBottom:`0.5px solid ${c.bd}`,fontWeight:700,fontSize:14,color:c.tx,paddingRight:50}}>{chMeta.title}</div>

            {/* Actions */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"12px 16px"}}>
              <button onClick={()=>{setMobMenu(false);setToc(true);}}
                style={{padding:"14px 12px",borderRadius:14,border:"none",background:theme==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.05)",color:c.tx,fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transition:"all .15s"}}>
                <I.List size={20}/> Mục lục
              </button>
              <button onClick={()=>{nextTheme();setMobMenu(false);}}
                style={{padding:"14px 12px",borderRadius:14,border:"none",background:theme==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.05)",color:c.tx,fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transition:"all .15s"}}>
                <span style={{fontSize:20}}>{theme==="dark"?"☀️":"🌙"}</span>
                Giao diện
              </button>
            </div>
            {/* Prev / Next */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 16px 14px"}}>
              <button onClick={()=>{if(prev){setChId(prev.id);window.scrollTo({top:0});setMobMenu(false);}}} disabled={!prev}
                style={{padding:"14px 12px",borderRadius:14,border:"none",background:prev?c.ac:"rgba(0,0,0,0.04)",color:prev?"#fff":c.tx3,fontWeight:700,fontSize:14,cursor:prev?"pointer":"default",opacity:prev?1:0.4,transition:"all .18s"}}>
                ← Trước
              </button>
              <button onClick={()=>{if(next){setChId(next.id);window.scrollTo({top:0});setMobMenu(false);}}} disabled={!next}
                style={{padding:"14px 12px",borderRadius:14,border:"none",background:next?c.ac:"rgba(0,0,0,0.04)",color:next?"#fff":c.tx3,fontWeight:700,fontSize:14,cursor:next?"pointer":"default",opacity:next?1:0.4,transition:"all .18s"}}>
                Sau →
              </button>
            </div>
            {/* Settings panel inline mobile - iOS style */}
            <div style={{padding:"0 12px 8px"}}>
              <div style={{height:"0.5px",background:theme==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",marginBottom:16}}/>

              {/* Cỡ chữ */}
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.05em"}}>Cỡ chữ</div>
                  <div style={{fontSize:13,fontWeight:700,color:c.ac,background:c.acBg,padding:"2px 10px",borderRadius:20}}>{fs}px</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <button onClick={()=>setFs(Math.max(14,fs-1))} style={{width:36,height:36,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx,fontSize:20,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>−</button>
                  <div style={{flex:1,position:"relative",height:4,borderRadius:4,background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}}>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",borderRadius:4,background:c.ac,width:`${((fs-14)/14)*100}%`,transition:"width .15s"}}/>
                    <input type="range" min="14" max="28" value={fs} onChange={e=>setFs(+e.target.value)} style={{position:"absolute",left:0,top:-10,width:"100%",height:24,opacity:0,cursor:"pointer"}}/>
                  </div>
                  <button onClick={()=>setFs(Math.min(28,fs+1))} style={{width:36,height:36,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx,fontSize:20,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                </div>
              </div>

              {/* Phông chữ */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Phông chữ</div>
                <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                  {FONTS.map((f,i)=>(
                    <button key={f.n} onClick={()=>setFi(i)} style={{flexShrink:0,padding:"8px 14px",borderRadius:20,border:"none",background:fi===i?c.ac:(theme==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)"),color:fi===i?"#fff":c.tx,fontSize:13,fontFamily:f.f,fontWeight:fi===i?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>
                      {f.n}
                    </button>
                  ))}
                </div>
              </div>


              {/* Dãn dòng */}
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.05em"}}>Dãn dòng</div>
                  <div style={{fontSize:13,fontWeight:700,color:c.ac,background:c.acBg,padding:"2px 10px",borderRadius:20}}>{lh.toFixed(2)}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <button onClick={()=>setLh(l=>Math.max(1.4,+(l-0.1).toFixed(1)))} style={{width:36,height:36,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx,fontSize:20,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>−</button>
                  <div style={{flex:1,position:"relative",height:4,borderRadius:4,background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"}}>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",borderRadius:4,background:c.ac,width:`${((lh-1.4)/1.2)*100}%`,transition:"width .15s"}}/>
                    <input type="range" min="1.4" max="2.6" step="0.1" value={lh} onChange={e=>setLh(+e.target.value)} style={{position:"absolute",left:0,top:-10,width:"100%",height:24,opacity:0,cursor:"pointer"}}/>
                  </div>
                  <button onClick={()=>setLh(l=>Math.min(2.6,+(l+0.1).toFixed(1)))} style={{width:36,height:36,borderRadius:50,border:"none",background:theme==="dark"?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.07)",color:c.tx,fontSize:20,fontWeight:300,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                </div>
              </div>

              {/* Độ rộng */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:600,color:c.tx3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Độ rộng</div>
                <div style={{display:"flex",gap:6,background:theme==="dark"?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)",borderRadius:12,padding:4}}>
                  {[{lb:"Hẹp",v:500},{lb:"Vừa",v:660},{lb:"Rộng",v:860},{lb:"Full",v:9999}].map(o=>(
                    <button key={o.v} onClick={()=>setCw(o.v)} style={{flex:1,padding:"8px 0",borderRadius:9,border:"none",background:cw===o.v?(theme==="dark"?"rgba(255,255,255,0.15)":"#fff"):"transparent",color:cw===o.v?c.tx:c.tx2,fontSize:13,fontWeight:cw===o.v?700:500,cursor:"pointer",transition:"all .18s",boxShadow:cw===o.v?"0 1px 4px rgba(0,0,0,0.12)":"none"}}>{o.lb}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MOBILE TOC BOTTOM SHEET ── */}
      {mob && toc && (
        <>
          <div onClick={()=>setToc(false)} style={{position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,0.45)"}}/>
          <div className="au" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:c.s,borderRadius:"18px 18px 0 0",padding:"0 0 env(safe-area-inset-bottom,16px)",boxShadow:"0 -4px 30px rgba(0,0,0,0.2)",maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"center",padding:"10px 0 6px"}}><div style={{width:36,height:4,borderRadius:2,background:c.bd}}/></div>
            <div style={{padding:"6px 20px 12px",borderBottom:`1px solid ${c.bd}`,fontWeight:700,fontSize:14,color:c.tx}}>{chapters.length} chương</div>
            <div style={{padding:"8px 10px 4px"}}>
              <input placeholder="🔍 Tìm chương..." value={tocSearch} onChange={e=>handleTocSearch(e.target.value)}
                style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1px solid ${c.bd}`,background:c.bg,color:c.tx,fontSize:14,fontFamily:"Arial,sans-serif",outline:"none",boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor=c.ac} onBlur={e=>e.target.style.borderColor=c.bd}
              />
            </div>
            <div style={{flex:1,overflowY:"hidden",padding:"4px 10px 8px",display:"flex",flexDirection:"column"}}>
              {tocSearchDebounced&&filteredChapters.length===0&&(
                <div style={{textAlign:"center",padding:"16px 0",color:c.tx3,fontSize:13}}>Không tìm thấy</div>
              )}
              <VirtualList
                items={filteredChapters}
                itemHeight={44}
                containerStyle={{flex:1}}
                renderItem={ch=>(
                  <button onClick={()=>{setChId(ch.id);setToc(false);setTocSearch('');setTocSearchDebounced('');window.scrollTo({top:0});}}
                    style={{width:"100%",height:44,padding:"0 12px",borderRadius:8,textAlign:"left",border:"none",background:chapterId===ch.id?c.acBg:"transparent",color:chapterId===ch.id?c.ac:c.tx,fontSize:14,fontWeight:chapterId===ch.id?600:400,cursor:"pointer",display:"flex",alignItems:"center",boxSizing:"border-box",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                    {bookmark===ch.id && <span style={{color:c.ac,marginRight:6}}>🔖</span>}{ch.title}
                  </button>
                )}
              />
            </div>
          </div>
        </>
      )}

      {/* -- SETTINGS PANEL -- */}
      {/* -- CONTENT -- */}
      <div key={chapterId} className="ch-content" style={{maxWidth:cw,margin:"36px auto 0",paddingBottom:24,paddingLeft:16,paddingRight:16}}>
        {(()=>{
          // Build global item names từ tất cả chapters đã cache
          const extractNames = (paragraphs) => paragraphs
            .filter(b=>b.type==="box")
            .flatMap(b=>b.content.split("\n").map(l=>l.trim()).filter(l=>/^\[.+\]$/.test(l)))
            .map(l=>l.slice(1,-1).trim())
            .filter(n=>n.length>2);
          const allCached = Object.values(chapterCache.current);
          const globalNames = [...new Set([
            ...allCached.flatMap(ch=>ch.paragraphs ? extractNames(ch.paragraphs) : []),
            ...extractNames(chData.paragraphs)
          ])];
          return chData.paragraphs.filter(block=>!(block.type==="text"&&isSFX(block.content))).map((block,i)=>(
            <Block key={i} block={block} c={c} font={font} fs={fs} lh={lh} mob={mob} itemNames={globalNames}/>
          ));
        })()}
      </div>

      {/* -- PREV / NEXT -- */}
      {!mob && (
        <div style={{maxWidth:cw,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"24px 0 20px",borderTop:`1px solid ${c.bd}`}}>
          <button onClick={()=>prev&&setChId(prev.id)} disabled={!prev}
            style={{display:"flex",alignItems:"center",gap:5,padding:"10px 18px",borderRadius:8,border:`1px solid ${prev?c.ac:c.bd}`,background:prev?c.ac:"transparent",color:prev?"#fff":c.tx3,cursor:prev?"pointer":"default",fontSize:13,fontWeight:600,fontFamily:"Arial,sans-serif",transition:"all .2s"}}>
            <I.L/> Chương trước
          </button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:12,color:c.tx3,fontWeight:500}}>{idx+1} / {chapters.length}</div>
          </div>
          <button onClick={()=>next&&setChId(next.id)} disabled={!next}
            style={{display:"flex",alignItems:"center",gap:5,padding:"10px 18px",borderRadius:8,border:`1px solid ${next?c.ac:c.bd}`,background:next?c.ac:"transparent",color:next?"#fff":c.tx3,cursor:next?"pointer":"default",fontSize:13,fontWeight:600,fontFamily:"Arial,sans-serif",transition:"all .2s"}}>
            Chương sau <I.R/>
          </button>
        </div>
      )}
      {/* Mobile: fixed bottom nav bar */}
      {mob && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:80,background:c.nav,borderTop:`1px solid ${c.bd}`,display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",padding:"8px 12px",paddingBottom:"max(8px,env(safe-area-inset-bottom,8px))"}}>
          <button onClick={()=>prev&&(setChId(prev.id),window.scrollTo({top:0}))} disabled={!prev}
            style={{padding:"10px",borderRadius:8,border:`1px solid ${prev?c.ac:c.bd}`,background:prev?c.ac:"transparent",color:prev?"#fff":c.tx3,fontWeight:600,fontSize:13,cursor:prev?"pointer":"default"}}>
            ← Trước
          </button>
          <button onClick={()=>setMobMenu(true)}
            style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${c.bd}`,background:c.s,color:c.tx,fontWeight:600,fontSize:13,cursor:"pointer",margin:"0 8px"}}>
            ⋯ Menu
          </button>
          <button onClick={()=>next&&(setChId(next.id),window.scrollTo({top:0}))} disabled={!next}
            style={{padding:"10px",borderRadius:8,border:`1px solid ${next?c.ac:c.bd}`,background:next?c.ac:"transparent",color:next?"#fff":c.tx3,fontWeight:600,fontSize:13,cursor:next?"pointer":"default"}}>
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}

// -- UPLOAD --
function Upload({c,chapters,addChapters,deleteChapter,deleteAllChapters,flash,theme,nextTheme}){
  const ref=useRef(null);
  const [drag,setDrag]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [chSearch,setChSearch]=useState("");
  const [chSearchDebounced,setChSearchDebounced]=useState("");
  const chSearchTimer=useRef(null);
  const handleChSearch=useCallback(v=>{
    setChSearch(v);
    clearTimeout(chSearchTimer.current);
    chSearchTimer.current=setTimeout(()=>setChSearchDebounced(v),200);
  },[]);
  const filteredUpChapters=useMemo(()=>{
    if(!chSearchDebounced) return chapters;
    const q=chSearchDebounced.toLowerCase();
    return chapters.filter(ch=>ch.title.toLowerCase().includes(q));
  },[chapters,chSearchDebounced]);

  const processFiles=async(fileList)=>{
    const accepted=Array.from(fileList).filter(f=>/\.(docx|doc|txt)$/i.test(f.name));
    const rej=fileList.length-accepted.length;
    if(rej) flash(`⚠️ Bỏ qua ${rej} file không hỗ trợ`,"#f59e0b");
    if(!accepted.length) return;
    setProcessing(true);
    const results=[];
    for(const file of accepted){
      try{
        let blocks;
        if(/\.(docx|doc)$/i.test(file.name)){
          blocks = await parseDocx(file);
        } else {
          const raw = await parseTxt(file);
          blocks = textToBlocks(raw);
        }
        const meta = extractMeta(file, blocks, chapters.length+results.length+1);
        results.push(meta);
      }catch(e){
        console.error(e);
        flash(`❌ ${file.name}: ${String(e.message||e).slice(0,60)}`,"#ef4444");
      }
    }
    const ids=new Set([...chapters.map(c=>c.id)]);
    const toAdd=results.filter(r=>!ids.has(r.id));
    if(results.length-toAdd.length>0) flash(`⚠️ Bỏ qua ${results.length-toAdd.length} chương trùng`,"#f59e0b");
    if(toAdd.length>0){
      addChapters(toAdd.map(({fileName,...rest})=>rest));
      flash(`✅ Đã thêm ${toAdd.length} chương!`);
    }
    setProcessing(false);
  };

  return(
    <div className="au" style={{maxWidth:580,margin:"0 auto",padding:"32px 0 60px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,letterSpacing:"-0.02em",fontFamily:"Arial,sans-serif"}}>Đăng chương mới</h1>
          <p style={{color:c.tx2,fontSize:13,marginTop:2}}>Hỗ trợ <strong>.docx</strong>, <strong>.doc</strong>, <strong>.txt</strong></p>
        </div>
        <button onClick={nextTheme} style={{width:32,height:32,borderRadius:7,border:`1px solid ${c.bd}`,background:c.s,color:c.tx2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {theme==="dark"?<I.Sun/>:<I.Moon/>}
        </button>
      </div>

      <div style={{background:c.s,borderRadius:12,padding:24,border:`1px solid ${c.bd}`,boxShadow:c.sh}}>
        <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);processFiles(e.dataTransfer.files);}}
          onClick={()=>!processing&&ref.current && ref.current.click()}
          style={{border:`2px dashed ${drag?c.ac:c.bd}`,borderRadius:10,padding:"40px 16px",textAlign:"center",cursor:processing?"wait":"pointer",background:drag?c.acBg:c.bg,transition:"all .25s",marginBottom:0}}>
          <input ref={ref} type="file" multiple accept=".docx,.doc,.txt" style={{display:"none"}} onChange={e=>{processFiles(e.target.files);e.target.value="";}}/>
          <div style={{fontSize:32,marginBottom:8}}>{processing?"⏳":"📂"}</div>
          <p style={{fontWeight:700,fontSize:14,color:drag?c.ac:c.tx,marginBottom:4,fontFamily:"Arial,sans-serif"}}>{processing?"Đang xử lý...":"Kéo thả file vào đây"}</p>
          <p style={{fontSize:12,color:c.tx3}}>hoặc click để chọn • .docx .doc .txt</p>
        </div>

        {processing&&(
          <div style={{textAlign:"center",padding:"12px 0",color:c.tx2,fontSize:13}}>⏳ Đang xử lý...</div>
        )}
      </div>

      {chapters.length>0&&(
        <div style={{marginTop:20,background:c.s,borderRadius:10,padding:18,border:`1px solid ${c.bd}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <Lbl c={c} style={{margin:0}}>Chương đã có ({chapters.length})</Lbl>
            <button onClick={()=>{if(window.confirm(`Xoá tất cả ${chapters.length} chương?`)){deleteAllChapters();flash("🗑️ Đã xoá tất cả chương","#ef4444");}}}
              style={{padding:"4px 12px",borderRadius:6,border:"1.5px solid #ef4444",background:"transparent",color:"#ef4444",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Arial,sans-serif"}}>
              Xoá tất cả
            </button>
          </div>
          <input
            placeholder="🔍 Tìm chương..."
            value={chSearch} onChange={e=>handleChSearch(e.target.value)}
            style={{width:"100%",padding:"7px 12px",borderRadius:7,border:`1.5px solid ${c.bd}`,background:c.bg,color:c.tx,fontSize:13,fontFamily:"Arial,sans-serif",marginBottom:10,outline:"none",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor=c.ac} onBlur={e=>e.target.style.borderColor=c.bd}
          />
          <div style={{maxHeight:320,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {chSearchDebounced&&filteredUpChapters.length===0&&(
              <div style={{textAlign:"center",padding:"16px 0",color:c.tx3,fontSize:13}}>Không tìm thấy chương nào</div>
            )}
            <VirtualList
              items={filteredUpChapters}
              itemHeight={40}
              containerStyle={{flex:1,maxHeight:320}}
              renderItem={ch=>(
                <div style={{height:40,display:"flex",alignItems:"center",gap:8,padding:"0 10px",borderRadius:6,background:c.bg,border:`1px solid ${c.bd}`,boxSizing:"border-box",marginBottom:3}}>
                  <span style={{flex:1,fontSize:13,color:c.tx,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{ch.title}</span>
                  <button onClick={()=>{deleteChapter(ch.id);flash(`🗑️ Đã xoá: ${ch.title}`,"#ef4444");}}
                    style={{width:26,height:26,borderRadius:5,border:"none",background:"transparent",color:c.tx3,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14}}
                    onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color=c.tx3}>
                    <I.X/>
                  </button>
                </div>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Lbl({c,children,style={}}){
  return <div style={{fontSize:11,fontWeight:700,color:c.tx2,marginBottom:6,letterSpacing:"0.04em",...style}}>{children}</div>;
}