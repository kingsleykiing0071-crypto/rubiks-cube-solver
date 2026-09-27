const FACES = ["U", "R", "F", "D", "L", "B"];
const COLOR = { W: "var(--W)", Y: "var(--Y)", R: "var(--R)", O: "var(--O)", B: "var(--B)", G: "var(--G)" };
const NAME = { W: "white", Y: "yellow", R: "red", O: "orange", B: "blue", G: "green" };
const CENTER = { U: "W", R: "R", F: "G", D: "Y", L: "O", B: "B" };
const FACE_NAME = {
  U: "UP (white centre)",
  R: "RIGHT (red centre)",
  F: "FRONT (green centre)",
  D: "DOWN (yellow centre)",
  L: "LEFT (orange centre)",
  B: "BACK (blue centre)"
};
const DIR = { "": "clockwise", "'": "anti-clockwise", "2": "a half turn (180°)" };
const LETTER_TO_COLOR = { U: "W", R: "R", F: "G", D: "Y", L: "O", B: "B" };
const NET_POS = { U: [3, 0], L: [0, 3], F: [3, 3], R: [6, 3], B: [9, 3], D: [3, 6] };

let selected = "W";
let state = solvedState();
let solution = [];
let step = 0;
let playing = false;
let playTimer = null;
let solverReady = false;
let startState = null;
let startFacelets = "";

function solvedState() {
  const s = {};
  for (const f of FACES) s[f] = Array(9).fill(CENTER[f]);
  return s;
}

function cloneState(s) {
  const o = {};
  for (const f of FACES) o[f] = s[f].slice();
  return o;
}

function stateFromFacelets(str) {
  const s = solvedState();
  FACES.forEach((f, fi) => {
    for (let i = 0; i < 9; i++) s[f][i] = LETTER_TO_COLOR[str[fi * 9 + i]] || "W";
  });
  return s;
}

function applyAlgToFacelets(startStr, tokens) {
  const cube = Cube.fromString(startStr);
  if (tokens.length) cube.move(tokens.join(" "));
  return cube.asString();
}

function toFaceletString(s) {
  const colorToLetter = {};
  for (const f of FACES) colorToLetter[CENTER[f]] = f;
  return FACES.map((f) => s[f].map((c) => colorToLetter[c] || "?").join("")).join("");
}

function countColors(s) {
  const c = { W: 0, Y: 0, R: 0, O: 0, B: 0, G: 0 };
  for (const f of FACES) s[f].forEach((x) => c[x]++);
  return c;
}

function validatePaint(s) {
  const counts = countColors(s);
  const bad = Object.entries(counts).filter(([, n]) => n !== 9);
  if (bad.length) {
    return (
      "Each colour needs exactly 9 stickers. Now: " +
      Object.entries(counts).map(([k, n]) => NAME[k] + " " + n).join(", ") +
      "."
    );
  }
  const str = toFaceletString(s);
  if (str.includes("?")) return "Unknown colour on the cube.";
  try {
    const cube = Cube.fromString(str);
    if (typeof cube.verify === "function") {
      const v = cube.verify();
      if (v !== true && v !== undefined && v !== 0) {
        return "That colouring cannot exist on a real cube. Check for swapped pieces or a twisted corner.";
      }
    }
  } catch (e) {
    return "That colouring cannot exist on a real cube. Double-check each face.";
  }
  return null;
}

function renderPalette() {
  const el = document.getElementById("palette");
  el.innerHTML = "";
  for (const c of ["W", "Y", "R", "O", "B", "G"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (selected === c ? " active" : "");
    b.dataset.c = c;
    b.title = NAME[c];
    b.onclick = () => {
      selected = c;
      renderPalette();
    };
    el.appendChild(b);
  }
}

function renderNet() {
  const net = document.getElementById("net");
  net.innerHTML = "";
  const cells = {};
  for (const f of FACES) {
    const [gx, gy] = NET_POS[f];
    for (let i = 0; i < 9; i++) {
      const r = Math.floor(i / 3),
        c = i % 3;
      cells[gy + r + "," + (gx + c)] = { f, i };
    }
  }
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 12; x++) {
      const key = y + "," + x;
      const div = document.createElement("div");
      if (cells[key]) {
        const { f, i } = cells[key];
        div.className = "sticker" + (i === 4 ? " center" : "");
        div.style.background = COLOR[state[f][i]];
        if (i !== 4) {
          div.onclick = () => {
            state[f][i] = selected;
            renderNet();
            renderMinis(state);
            document.getElementById("paintStatus").textContent = "Keep painting, then press Teach me.";
            document.getElementById("paintStatus").className = "status";
            resetLesson();
          };
        }
      } else {
        div.className = "face-label";
        if (x === 4 && y === 1) div.textContent = "UP";
        if (x === 1 && y === 4) div.textContent = "L";
        if (x === 4 && y === 4) div.textContent = "FRONT";
        if (x === 7 && y === 4) div.textContent = "R";
        if (x === 10 && y === 4) div.textContent = "BACK";
        if (x === 4 && y === 7) div.textContent = "DOWN";
      }
      net.appendChild(div);
    }
  }
}

function renderMinis(s) {
  const host = document.getElementById("miniFaces");
  host.innerHTML = "";
  const order = [
    ["U", "up"],
    ["L", "left"],
    ["F", "front"],
    ["R", "right"],
    ["B", "back"],
    ["D", "down"]
  ];
  const labels = { U: "UP", D: "DOWN", F: "FRONT", B: "BACK", R: "RIGHT", L: "LEFT" };
  order.forEach(([f, cls]) => {
    const wrap = document.createElement("div");
    wrap.className = "mini-wrap " + cls;
    const g = document.createElement("div");
    g.className = "mini";
    for (let i = 0; i < 9; i++) {
      const d = document.createElement("i");
      d.style.background = COLOR[s[f][i]];
      g.appendChild(d);
    }
    wrap.appendChild(g);
    wrap.appendChild(document.createTextNode(labels[f]));
    host.appendChild(wrap);
  });
}

function parseMoves(str) {
  if (!str) return [];
  return str.trim().split(/\s+/).filter(Boolean);
}

function describeMove(token) {
  const face = token[0];
  const suf = token.slice(1);
  const how = DIR[suf] || DIR[""];
  return {
    title: "Turn the " + FACE_NAME[face].split(" (")[0].toLowerCase() + " face " + how,
    text:
      "Look at the face with the " +
      NAME[CENTER[face]] +
      " centre. Turn that whole face " +
      how +
      ". Keep the white centre on top and the green centre in front while you do it."
  };
}

function stateAt(n) {
  return stateFromFacelets(applyAlgToFacelets(startFacelets, solution.slice(0, n)));
}

function showStep() {
  const letter = document.getElementById("moveLetter");
  const title = document.getElementById("moveTitle");
  const text = document.getElementById("moveText");
  const pill = document.getElementById("stagePill");
  const bar = document.getElementById("bar");
  const count = document.getElementById("stepsCount");
  const box = document.getElementById("algoBox");

  if (!solution.length) {
    letter.innerHTML = "—<small>MOVE</small>";
    title.textContent = "Press Teach me";
    text.textContent = "I will check your colours, then show each turn so you can copy it on your real cube.";
    pill.textContent = "Ready when you are";
    bar.style.width = "0%";
    count.textContent = "0 / 0 moves";
    box.textContent = "Solution will appear here.";
    renderNet();
    renderMinis(state);
    return;
  }

  const total = solution.length;
  if (step >= total) {
    letter.innerHTML = "✓<small>DONE</small>";
    title.textContent = "Solved!";
    text.textContent = "Every sticker should match. Give the cube a little wiggle — you did it.";
    pill.textContent = "Finished";
    bar.style.width = "100%";
    count.textContent = total + " / " + total + " moves";
    box.innerHTML = solution.join(" ");
    state = stateAt(total);
    renderNet();
    renderMinis(state);
  } else {
    const mv = solution[step];
    const d = describeMove(mv);
    letter.innerHTML = mv + "<small>MOVE " + (step + 1) + "</small>";
    title.textContent = d.title;
    text.textContent = d.text;
    pill.textContent = "Move " + (step + 1) + " of " + total;
    bar.style.width = (step / total) * 100 + "%";
    count.textContent = step + " / " + total + " moves";
    box.innerHTML = solution.map((m, i) => (i === step ? '<span class="on">' + m + "</span>" : m)).join(" ");
    state = stateAt(step);
    renderNet();
    renderMinis(state);
  }
  document.getElementById("btnPrev").disabled = step <= 0;
  document.getElementById("btnNext").disabled = step >= solution.length;
  document.getElementById("btnPlay").disabled = !solution.length || step >= solution.length;
}

function resetLesson() {
  solution = [];
  step = 0;
  startState = null;
  startFacelets = "";
  stopPlay();
  document.getElementById("btnPrev").disabled = true;
  document.getElementById("btnNext").disabled = true;
  document.getElementById("btnPlay").disabled = true;
  showStep();
}

function stopPlay() {
  playing = false;
  clearInterval(playTimer);
  document.getElementById("btnPlay").textContent = "Play";
}

function scramble() {
  const faces = ["U", "D", "L", "R", "F", "B"];
  const suf = ["", "'", "2"];
  const moves = [];
  let last = "";
  for (let i = 0; i < 25; i++) {
    let f = faces[Math.floor(Math.random() * 6)];
    while (f === last) f = faces[Math.floor(Math.random() * 6)];
    last = f;
    moves.push(f + suf[Math.floor(Math.random() * 3)]);
  }
  const cube = new Cube();
  cube.move(moves.join(" "));
  state = stateFromFacelets(cube.asString());
  renderNet();
  renderMinis(state);
  resetLesson();
  document.getElementById("paintStatus").textContent = "Practice scramble ready. Press Teach me.";
  document.getElementById("paintStatus").className = "status ok";
}

document.getElementById("btnSolved").onclick = () => {
  state = solvedState();
  renderNet();
  renderMinis(state);
  resetLesson();
  document.getElementById("paintStatus").textContent = "Back to a solved cube.";
  document.getElementById("paintStatus").className = "status ok";
};

document.getElementById("btnClear").onclick = () => {
  for (const f of FACES) {
    for (let i = 0; i < 9; i++) if (i !== 4) state[f][i] = "W";
  }
  renderNet();
  renderMinis(state);
  resetLesson();
  document.getElementById("paintStatus").textContent = "Side stickers cleared. Paint the colours you see.";
  document.getElementById("paintStatus").className = "status";
};

document.getElementById("btnScramble").onclick = scramble;

document.getElementById("btnSolve").onclick = () => {
  const err = validatePaint(state);
  const status = document.getElementById("paintStatus");
  if (err) {
    status.textContent = err;
    status.className = "status bad";
    return;
  }
  if (!solverReady) {
    status.textContent = "Teacher is still warming up. Try again in a second.";
    status.className = "status";
    return;
  }
  const str = toFaceletString(state);
  let cube;
  try {
    cube = Cube.fromString(str);
  } catch (e) {
    status.textContent = "Could not read that cube. Check the colours.";
    status.className = "status bad";
    return;
  }
  if (str === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB") {
    status.textContent = "This cube is already solved!";
    status.className = "status ok";
    solution = [];
    startState = cloneState(state);
    step = 0;
    showStep();
    document.getElementById("moveTitle").textContent = "Already solved";
    document.getElementById("moveText").textContent = "Every face is a solid colour. Mix it with Scramble, or paint a real cube.";
    return;
  }
  status.textContent = "Working out the steps…";
  status.className = "status";
  setTimeout(() => {
    try {
      const raw = cube.solve();
      if (!raw) throw new Error("no solution");
      solution = parseMoves(raw.replace(/\s+$/, ""));
      startState = cloneState(state);
      startFacelets = str;
      step = 0;
      status.textContent = "Got it — " + solution.length + " turns. Copy each one on your cube.";
      status.className = "status ok";
      document.getElementById("btnPrev").disabled = true;
      document.getElementById("btnNext").disabled = false;
      document.getElementById("btnPlay").disabled = false;
      showStep();
    } catch (e) {
      status.textContent = "That colouring is not a real cube (a piece may be twisted or two stickers swapped). Fix the paint and try again.";
      status.className = "status bad";
    }
  }, 30);
};

document.getElementById("btnNext").onclick = () => {
  if (step < solution.length) step += 1;
  stopPlay();
  showStep();
};

document.getElementById("btnPrev").onclick = () => {
  if (step > 0) step -= 1;
  stopPlay();
  showStep();
};

document.getElementById("btnPlay").onclick = () => {
  if (!solution.length) return;
  if (playing) {
    stopPlay();
    return;
  }
  playing = true;
  document.getElementById("btnPlay").textContent = "Pause";
  playTimer = setInterval(() => {
    if (step >= solution.length) {
      stopPlay();
      showStep();
      return;
    }
    step += 1;
    showStep();
  }, 900);
};

renderPalette();
renderNet();
renderMinis(state);
showStep();

const badge = document.getElementById("solverBadge");
try {
  if (typeof Cube === "undefined") throw new Error("library missing");
  badge.lastChild.textContent = " Warming up the solver…";
  setTimeout(() => {
    Cube.initSolver();
    solverReady = true;
    badge.classList.add("ready");
    badge.lastChild.textContent = " Teacher ready";
  }, 50);
} catch (e) {
  badge.lastChild.textContent = " Solver files missing";
}
