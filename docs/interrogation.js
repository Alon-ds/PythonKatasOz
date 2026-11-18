const NS = "http://www.w3.org/2000/svg";
const PX = 10;
const ABORT = Symbol("abort");

const INVESTIGATOR = [
  ".......H.HH..H.H........",
  "......HHHhHHHHHhH.......",
  "......HHHHHhHHHHHH......",
  "......HHSSSSSSSShH......",
  "......HSSSSSSSSSSH......",
  "......HSSSSSSSSSSH......",
  "......SHHHHSSHHHHS......",
  "......SSSSSSSSSSSS......",
  ".....sGGGGGGGGGGGGs.....",
  ".....sGwEggGGwEggGs.....",
  "......fggggffggggf......",
  "......SffffSSffffS......",
  "......SSSSSnnSSSSS......",
  "......BSSSSnnSSSSB......",
  "......BBSSnnnnSSBB......",
  "......BBBBBBBBBBBB......",
  "......BBBBBMMBBBBB......",
  "......BbBBBBBBBBbB......",
  ".......BbBbbbbBbB.......",
  "........BbbbbbbB........",
  ".........BbbbbB.........",
  "..........SSSS..........",
  ".....TTTTTSSSSTTTTT.....",
  "...TTTTTTTTTTTTTTTTTT...",
  "..TTTTTTTRRrRRrRTTTTTT..",
  "..TTTTTTRRRRrRRRRTTTTT..",
  "..TTTTTTTRRRrRRRTTTTTT..",
  "..TTTTTTTTRRRRTTTTTTTT..",
  "..TtTTTTTTTTTTTTTTTTtT..",
  "..SSTTTTTTTTTTTTTTTTSS..",
  "..SSTTTTTTTTTTTTTTTTSS..",
  "..SSTTTTTTTTTTTTTTTTSS..",
  "..SSTTTTTTTTTTTTTTTTSS..",
  "..SSTTTTTTTTTTTTTTTTSS..",
  "..ssTTTTTTTTTTTTTTTTss..",
  "....PPPPPPPPPPPPPPPP....",
  "....PPPPPPPPPPPPPPPP....",
  "....PPPPPPP..PPPPPPP....",
  "....PPPPPPP..PPPPPPP....",
  "....PPPPPPP..PPPPPPP....",
  "....PPPPPPP..PPPPPPP....",
  "....PPPPPPP..PPPPPPP....",
  "....PPPPPPP..PPPPPPP....",
  "...KKKKKKKK..KKKKKKKK...",
];

const COLORS = {
  H: "#2b2522", h: "#4a3f37", S: "#d9a27e", s: "#b9805e", n: "#c08a66", G: "#141414", g: "#ebc3a6", f: "#5a4a42", w: "#f3ebe2", E: "#1e1a18",
  B: "#3a322c", b: "#8c857c", M: "#6b3a30", T: "#1c1c1f", t: "#2c2c31", R: "#8e2b2b", r: "#6e1f1f",
  P: "#3a3f55", K: "#111111",
};

let run = 0;
let overlay = null;
let onKey = null;
let returnFocus = null;

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function div(cls, parent, text = null, tag = "div") {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== null) node.textContent = text;
  parent.appendChild(node);
  return node;
}

function bitmap(rows, colors, parent) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) el("rect", { x: x * PX, y: y * PX, width: PX, height: PX, fill: colors[ch] }, parent);
  }));
}

/* ---------- the room ---------- */

function drawRoom(svg) {
  el("rect", { x: 0, y: 0, width: 800, height: 380, fill: "#565b6b" }, svg);
  for (let y = 40; y < 380; y += 40) {
    el("rect", { x: 0, y, width: 800, height: 4, fill: "#4c5160" }, svg);
    for (let x = (y / 40) % 2 ? 0 : 60; x < 800; x += 120) {
      el("rect", { x, y: y - 40, width: 4, height: 40, fill: "#4c5160" }, svg);
    }
  }
  el("rect", { x: 0, y: 380, width: 800, height: 120, fill: "#2f323c" }, svg);
  for (let x = 0; x < 800; x += 80) el("rect", { x, y: 380, width: 4, height: 120, fill: "#272a33" }, svg);

  el("rect", { x: 40, y: 70, width: 220, height: 130, fill: "#18202e", stroke: "#2a2d36", "stroke-width": 8 }, svg);
  el("polygon", { points: "70,190 130,80 150,80 90,190", fill: "#ffffff", opacity: 0.07 }, svg);
  el("polygon", { points: "120,190 180,80 190,80 130,190", fill: "#ffffff", opacity: 0.07 }, svg);

  el("rect", { x: 660, y: 170, width: 100, height: 210, fill: "#22252d" }, svg);
  const door = el("g", { class: "door" }, svg);
  el("rect", { x: 660, y: 170, width: 100, height: 210, fill: "#7a6a58", stroke: "#241a33", "stroke-width": 4 }, door);
  el("rect", { x: 676, y: 190, width: 68, height: 60, fill: "#6a5b4b" }, door);
  el("rect", { x: 740, y: 280, width: 10, height: 10, fill: "#e0c060" }, door);
}

function drawLamp(svg) {
  const lamp = el("g", { class: "lamp" }, svg);
  el("polygon", { class: "cone", points: "355,122 445,122 600,380 200,380", fill: "#ffe9a0", opacity: 0.16 }, lamp);
  el("rect", { x: 398, y: 0, width: 4, height: 92, fill: "#1e1e24" }, lamp);
  el("polygon", { points: "372,92 428,92 450,122 350,122", fill: "#3d4452", stroke: "#241a33", "stroke-width": 3 }, lamp);
  el("rect", { class: "bulb", x: 390, y: 118, width: 20, height: 8, fill: "#fff3b0" }, lamp);
}

function drawChair(svg) {
  el("rect", { x: 246, y: 240, width: 14, height: 96, fill: "#3b3f4a" }, svg);
  el("rect", { x: 246, y: 322, width: 74, height: 10, fill: "#3b3f4a" }, svg);
  el("rect", { x: 250, y: 332, width: 8, height: 48, fill: "#3b3f4a" }, svg);
  el("rect", { x: 308, y: 332, width: 8, height: 48, fill: "#3b3f4a" }, svg);
}

function drawTableTop(svg) {
  el("rect", { x: 340, y: 300, width: 270, height: 16, fill: "#9aa3ad", stroke: "#241a33", "stroke-width": 3 }, svg);
  el("rect", { x: 356, y: 316, width: 12, height: 64, fill: "#7d858f" }, svg);
  el("rect", { x: 582, y: 316, width: 12, height: 64, fill: "#7d858f" }, svg);
}

/* ---------- characters ---------- */

function drawStudent(svg, { login, avatar, color }) {
  const pos = el("g", { class: "student-pos" }, svg);
  const s = el("g", { class: "student" }, pos);

  const seated = el("g", { class: "legs-seated" }, s);
  el("rect", { x: -18, y: -26, width: 44, height: 14, fill: "#241a33" }, seated);
  el("rect", { x: 14, y: -14, width: 12, height: 40, fill: "#241a33" }, seated);

  const kneel = el("g", { class: "legs-kneel" }, s);
  el("rect", { x: -18, y: -26, width: 16, height: 26, fill: "#241a33" }, kneel);
  el("rect", { x: -34, y: -12, width: 30, height: 12, fill: "#241a33" }, kneel);

  el("rect", { x: -20, y: -62, width: 40, height: 38, fill: color, stroke: "#241a33", "stroke-width": 3 }, s);
  const arms = el("g", { class: "arms-down" }, s);
  el("rect", { x: -30, y: -58, width: 10, height: 28, fill: color, stroke: "#241a33", "stroke-width": 2 }, arms);
  el("rect", { x: 20, y: -58, width: 10, height: 28, fill: color, stroke: "#241a33", "stroke-width": 2 }, arms);
  const pray = el("g", { class: "arms-pray" }, s);
  el("rect", { x: 14, y: -64, width: 22, height: 10, fill: color, stroke: "#241a33", "stroke-width": 2 }, pray);
  el("rect", { x: 34, y: -76, width: 12, height: 18, fill: "#e8b896", stroke: "#241a33", "stroke-width": 2 }, pray);

  const clip = el("clipPath", { id: "interro-head" }, s);
  el("circle", { cx: 0, cy: -88, r: 24 }, clip);
  el("circle", { cx: 0, cy: -88, r: 24, fill: color }, s);
  const initial = el("text", {
    x: 0, y: -78, "font-size": 28, "font-weight": 700, "text-anchor": "middle", fill: "#fff4d6",
    stroke: "#241a33", "stroke-width": 5, "paint-order": "stroke",
  }, s);
  initial.textContent = login[0].toUpperCase();
  if (avatar) {
    el("image", {
      href: avatar, x: -24, y: -112, width: 48, height: 48, "clip-path": "url(#interro-head)",
      preserveAspectRatio: "xMidYMid slice",
    }, s).addEventListener("error", (e) => e.target.remove());
  }
  el("circle", { cx: 0, cy: -88, r: 24, fill: "none", stroke: "#241a33", "stroke-width": 4 }, s);
  el("rect", { x: -24, y: -120, width: 48, height: 12, fill: "#5b6b2f", stroke: "#241a33", "stroke-width": 3 }, s);
  el("rect", { x: -30, y: -110, width: 60, height: 7, fill: "#5b6b2f", stroke: "#241a33", "stroke-width": 3 }, s);

  el("polygon", { class: "sweat", points: "30,-108 36,-96 30,-92 24,-96", fill: "#8fd3ff", stroke: "#241a33", "stroke-width": 1.5 }, s);
  el("polygon", { class: "sweat sweat2", points: "-30,-100 -25,-90 -30,-86 -35,-90", fill: "#8fd3ff", stroke: "#241a33", "stroke-width": 1.5 }, s);
  return pos;
}

function drawInvestigator(svg) {
  const pos = el("g", { class: "inv-pos" }, svg);
  const body = el("g", { class: "inv" }, pos);
  bitmap(INVESTIGATOR, COLORS, body);
  return pos;
}

function drawProps(svg, login, count) {
  const file = el("g", { class: "file" }, svg);
  el("rect", { x: 346, y: 252, width: 146, height: 48, fill: "#e4c06a", stroke: "#241a33", "stroke-width": 3 }, file);
  el("rect", { x: 346, y: 246, width: 50, height: 8, fill: "#e4c06a", stroke: "#241a33", "stroke-width": 3 }, file);
  const t1 = el("text", { x: 419, y: 272, "font-size": 13, "font-weight": 700, "text-anchor": "middle", fill: "#241a33" }, file);
  t1.textContent = `SUBJECT: ${login.length > 16 ? `${login.slice(0, 15)}…` : login}`;
  const t2 = el("text", { x: 419, y: 290, "font-size": 12, "text-anchor": "middle", fill: "#5a2a1a" }, file);
  t2.textContent = `${count} kata${count === 1 ? "" : "s"} passed`;

  const paper = el("g", { class: "paper" }, svg);
  el("rect", { x: 498, y: 288, width: 64, height: 12, fill: "#ffffff", stroke: "#241a33", "stroke-width": 2 }, paper);
  el("rect", { x: 566, y: 292, width: 36, height: 5, fill: "#2f5fd0", stroke: "#241a33", "stroke-width": 1 }, paper);
}

/* ---------- script ---------- */

function setup({ login, passed, avatar, color, route }) {
  overlay = div("interro", document.body);
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Interrogation room");

  const stage = div("stage", overlay);
  const svg = el("svg", { viewBox: "0 0 800 500", class: "room", "aria-hidden": "true" }, stage);
  drawRoom(svg);
  drawChair(svg);
  const investigator = drawInvestigator(svg);
  const student = drawStudent(svg, { login, avatar, color });
  drawTableTop(svg);
  drawProps(svg, login, passed.length);
  drawLamp(svg);

  const invBubble = div("bubble inv", stage);
  const stuBubble = div("bubble stu", stage);
  invBubble.setAttribute("aria-live", "polite");
  stuBubble.setAttribute("aria-live", "polite");

  const skip = div("skip", stage, "Skip", "button");
  skip.type = "button";

  const end = div("endcard", stage);
  div("", end, "Katas are brain-only.", "h2");
  div("", end, "No Google. No AI. Just you, a pen and paper.", "p");
  const row = div("end-row", end);
  const replay = div("", row, "Replay", "button");
  const back = div("", row, "Back to the map", "button");

  const kata = passed.length ? passed[passed.length - 1] : route[0] || "hello_world";
  return { stage, svg, student, investigator, invBubble, stuBubble, skip, end, replay, back, kata };
}

function close() {
  run += 1;
  if (onKey) removeEventListener("keydown", onKey);
  overlay?.remove();
  overlay = null;
  returnFocus?.focus?.();
}

async function play(opts, id) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ui = setup(opts);
  let hurry = false;
  const alive = () => { if (id !== run) throw ABORT; };
  const wait = (ms) => new Promise((res) => {
    const t0 = Date.now();
    const tick = () => {
      if (id !== run || hurry || Date.now() - t0 >= ms) return res();
      setTimeout(tick, 40);
    };
    tick();
  }).then(() => { hurry = false; alive(); });
  const say = async (who, text, hold = 1100) => {
    const bubble = who === "inv" ? ui.invBubble : ui.stuBubble;
    const other = who === "inv" ? ui.stuBubble : ui.invBubble;
    other.classList.remove("show");
    bubble.textContent = "";
    bubble.classList.add("show");
    if (reduced) {
      bubble.textContent = text;
    } else {
      for (const ch of text) {
        alive();
        if (hurry) break;
        bubble.textContent += ch;
        await new Promise((r) => setTimeout(r, 30));
      }
      bubble.textContent = text;
      hurry = false;
    }
    await wait(hold + text.length * 25);
  };
  const mark = (cls, on = true) => ui.stage.classList.toggle(cls, on);

  ui.stage.addEventListener("click", (e) => { if (!e.target.closest("button")) hurry = true; });
  ui.skip.addEventListener("click", close);
  ui.back.addEventListener("click", close);
  ui.replay.addEventListener("click", () => interrogate(opts));
  onKey = (e) => { if (e.key === "Escape") close(); };
  addEventListener("keydown", onKey);
  ui.skip.focus();

  const { login, passed } = opts;
  const n = passed.length;
  try {
    await wait(700);
    mark("door-open");
    await wait(400);
    mark("inv-in");
    await wait(1700);
    mark("door-open", false);
    mark("file-in");
    await wait(250);
    mark("shake");
    await wait(450);
    mark("shake", false);
    await say("inv", n ? `So, ${login}. ${n} kata${n === 1 ? "" : "s"} passed.` : `So, ${login}. Nothing passed yet. Suspicious.`);
    await say("inv", "Did you use Google to find a solution?");
    mark("nervous");
    await say("stu", "No...", 1300);
    await say("inv", "Did you solve it with AI?");
    await say("stu", "I promise, no...", 1300);
    mark("paper-in");
    await say("inv", `Then explain ${ui.kata} to me. On paper.`, 1400);
    mark("panic");
    await say("stu", "...", 1200);
    mark("lean");
    await wait(600);
    mark("kneel");
    await say("stu", "PLEASE! I'll use pen and paper! I'll never open ChatGPT again! I have a family... of unit tests!", 1600);
    ui.stuBubble.classList.remove("show");
    await say("inv", "Pen. Paper. Think.", 1500);
    ui.invBubble.classList.remove("show");
    mark("ended");
    ui.replay.focus();
  } catch (err) {
    if (err !== ABORT) throw err;
  }
}

export function interrogate(opts) {
  if (overlay) {
    overlay.remove();
    if (onKey) removeEventListener("keydown", onKey);
  }
  returnFocus = opts.returnFocus || returnFocus;
  run += 1;
  play(opts, run);
}
