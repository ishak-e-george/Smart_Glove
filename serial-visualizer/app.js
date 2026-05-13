const fingerOrder = ["INDEX", "MIDDLE", "RING"];
const fingerAnchors = {
  INDEX: { x: 165, y: 295, spread: -0.18 },
  MIDDLE: { x: 250, y: 285, spread: 0 },
  RING: { x: 335, y: 298, spread: 0.16 }
};

const state = {
  port: null,
  reader: null,
  inputClosed: null,
  keepReading: false,
  frameCount: 0,
  parserMode: "Waiting",
  consoleLines: [],
  fingers: {
    INDEX: createFingerState("INDEX"),
    MIDDLE: createFingerState("MIDDLE"),
    RING: createFingerState("RING")
  }
};

const ui = {
  connectButton: document.getElementById("connectButton"),
  disconnectButton: document.getElementById("disconnectButton"),
  connectionStatus: document.getElementById("connectionStatus"),
  portName: document.getElementById("portName"),
  frameCount: document.getElementById("frameCount"),
  parserMode: document.getElementById("parserMode"),
  fingerCards: document.getElementById("fingerCards"),
  handCanvas: document.getElementById("handCanvas"),
  consoleOutput: document.getElementById("consoleOutput")
};

function createFingerState(name) {
  return {
    name,
    raw: null,
    smooth: null,
    flat: null,
    curl: null,
    range: null,
    quality: "N/A",
    percent: 0,
    state: "UNCALIBRATED",
    warning: ""
  };
}

function initialize() {
  if (!("serial" in navigator)) {
    ui.connectionStatus.textContent = "Web Serial unavailable";
    ui.connectButton.disabled = true;
    appendConsole("This browser does not support Web Serial. Use Chrome or Edge on localhost.");
  }

  ui.connectButton.addEventListener("click", connectSerial);
  ui.disconnectButton.addEventListener("click", disconnectSerial);
  renderFingerCards();
  renderHand();
}

async function connectSerial() {
  try {
    state.port = await navigator.serial.requestPort();
    await state.port.open({ baudRate: 115200 });
    state.keepReading = true;
    ui.connectButton.disabled = true;
    ui.disconnectButton.disabled = false;
    ui.connectionStatus.textContent = "Connected";
    ui.portName.textContent = "USB Serial @ 115200";
    appendConsole("Serial port opened.");
    startReading();
  } catch (error) {
    ui.connectionStatus.textContent = "Connection failed";
    appendConsole(`Connect error: ${error.message}`);
  }
}

async function disconnectSerial() {
  state.keepReading = false;

  try {
    if (state.reader) {
      await state.reader.cancel();
    }
  } catch (error) {
    appendConsole(`Reader cancel error: ${error.message}`);
  }

  try {
    if (state.inputClosed) {
      await state.inputClosed.catch(() => {});
    }
  } catch (error) {
    appendConsole(`Input close error: ${error.message}`);
  }

  try {
    if (state.port) {
      await state.port.close();
    }
  } catch (error) {
    appendConsole(`Port close error: ${error.message}`);
  }

  state.reader = null;
  state.inputClosed = null;
  state.port = null;
  ui.connectionStatus.textContent = "Disconnected";
  ui.portName.textContent = "Not selected";
  ui.connectButton.disabled = false;
  ui.disconnectButton.disabled = true;
  appendConsole("Serial port closed.");
}

async function startReading() {
  const textDecoder = new TextDecoderStream();
  state.inputClosed = state.port.readable.pipeTo(textDecoder.writable);
  const inputStream = textDecoder.readable;
  state.reader = inputStream.getReader();

  let buffer = "";

  try {
    while (state.keepReading) {
      const { value, done } = await state.reader.read();
      if (done) {
        break;
      }
      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        handleLine(line.trim());
      }
    }
  } catch (error) {
    appendConsole(`Read error: ${error.message}`);
    ui.connectionStatus.textContent = "Read error";
  } finally {
    if (state.reader) {
      state.reader.releaseLock();
      state.reader = null;
    }
  }
}

function handleLine(line) {
  if (!line) {
    return;
  }

  appendConsole(line);

  if (line.startsWith("VIS,")) {
    if (parseVisualizerLine(line)) {
      state.parserMode = "VIS compact";
      refreshUi();
    }
    return;
  }

  if (fingerOrder.some((fingerName) => line.startsWith(fingerName))) {
    if (parseDashboardLine(line)) {
      state.parserMode = "Dashboard";
      refreshUi();
    }
  }
}

function parseVisualizerLine(line) {
  const parts = line.split(",");
  if (parts.length < 13) {
    return false;
  }

  const mapped = [
    { name: "INDEX", base: 1 },
    { name: "MIDDLE", base: 5 },
    { name: "RING", base: 9 }
  ];

  for (const finger of mapped) {
    const record = state.fingers[finger.name];
    record.smooth = parseMaybeNumber(parts[finger.base]);
    record.percent = clampPercent(parseMaybeNumber(parts[finger.base + 1]));
    record.state = normalizeState(parts[finger.base + 2] || "UNCALIBRATED");
    record.range = parseMaybeNumber(parts[finger.base + 3]);
    record.quality = (parts[finger.base + 4] || "N/A").trim();
  }

  state.frameCount += 1;
  return true;
}

function parseDashboardLine(line) {
  const warningMatch = line.split("<--");
  const content = warningMatch[0].trim();
  const warning = warningMatch[1] ? warningMatch[1].trim() : "";
  const parts = content.split("|").map((part) => part.trim());
  const name = parts.shift();

  if (!name || !state.fingers[name]) {
    return false;
  }

  const record = state.fingers[name];
  record.warning = warning;

  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || rawValue === undefined) {
      continue;
    }

    const key = rawKey.trim();
    const value = rawValue.trim();

    if (key === "RAW") record.raw = parseMaybeNumber(value);
    if (key === "SMOOTH") record.smooth = parseMaybeNumber(value);
    if (key === "FLAT") record.flat = parseMaybeNumber(value);
    if (key === "CURL") record.curl = parseMaybeNumber(value);
    if (key === "RANGE") record.range = parseMaybeNumber(value);
    if (key === "QUALITY") record.quality = value;
    if (key === "PERCENT") record.percent = clampPercent(parseMaybeNumber(value));
    if (key === "STATE") record.state = normalizeState(value);
  }

  state.frameCount += 1;
  return true;
}

function parseMaybeNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const cleaned = String(value).replace("%", "").trim();
  if (cleaned === "N/A") {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeState(value) {
  return String(value || "UNCALIBRATED")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function appendConsole(line) {
  state.consoleLines.push(line);
  if (state.consoleLines.length > 40) {
    state.consoleLines.shift();
  }
  ui.consoleOutput.textContent = state.consoleLines.join("\n");
  ui.consoleOutput.scrollTop = ui.consoleOutput.scrollHeight;
}

function refreshUi() {
  ui.frameCount.textContent = String(state.frameCount);
  ui.parserMode.textContent = state.parserMode;
  renderFingerCards();
  renderHand();
}

function renderFingerCards() {
  ui.fingerCards.innerHTML = "";

  for (const fingerName of fingerOrder) {
    const finger = state.fingers[fingerName];
    const card = document.createElement("article");
    card.className = "finger-card";
    card.innerHTML = `
      <header>
        <h3>${finger.name}</h3>
        <span class="state-chip ${stateClassName(finger.state)}">${displayState(finger.state)}</span>
      </header>
      <div class="meter-row">
        <span>Curl</span>
        <div class="meter-track"><div class="meter-fill" style="width: ${finger.percent}%;"></div></div>
        <strong>${finger.percent}%</strong>
      </div>
      <div class="kv-grid">
        <div>Raw<strong>${formatNumber(finger.raw)}</strong></div>
        <div>Smooth<strong>${formatNumber(finger.smooth)}</strong></div>
        <div>Flat<strong>${formatNumber(finger.flat)}</strong></div>
        <div>Curl<strong>${formatNumber(finger.curl)}</strong></div>
        <div>Range<strong>${formatNumber(finger.range)}</strong></div>
        <div>Quality<strong>${finger.quality}</strong></div>
      </div>
      <div class="warning-text">${finger.warning || "No warning"}</div>
    `;
    ui.fingerCards.appendChild(card);
  }
}

function renderHand() {
  const svg = ui.handCanvas;
  svg.innerHTML = "";

  const backgroundPalm = createSvg("path", {
    d: "M130 300 C135 248, 170 210, 230 204 C290 196, 350 218, 377 268 C392 297, 392 330, 369 353 C340 383, 282 393, 224 387 C166 381, 124 354, 130 300 Z",
    fill: "#e6b687",
    stroke: "#915b35",
    "stroke-width": "4"
  });
  svg.appendChild(backgroundPalm);

  const wrist = createSvg("path", {
    d: "M192 382 C205 411, 297 411, 312 382",
    fill: "none",
    stroke: "#7a4a2b",
    "stroke-width": "18",
    "stroke-linecap": "round"
  });
  svg.appendChild(wrist);

  for (const fingerName of fingerOrder) {
    drawFinger(svg, fingerName, state.fingers[fingerName]);
  }
}

function drawFinger(svg, fingerName, finger) {
  const anchor = fingerAnchors[fingerName];
  const percent = clampPercent(finger.percent) / 100;
  const totalCurl = degToRad(10 + percent * 78);
  const bend1 = totalCurl * 0.28;
  const bend2 = totalCurl * 0.34;
  const bend3 = totalCurl * 0.38;

  const baseDirection = -Math.PI / 2 + anchor.spread;
  const p0 = { x: anchor.x, y: anchor.y };
  const p1 = polarPoint(p0, 102, baseDirection + bend1);
  const p2 = polarPoint(p1, 74, baseDirection + bend1 + bend2);
  const p3 = polarPoint(p2, 54, baseDirection + bend1 + bend2 + bend3);
  const stroke = fingerColor(finger.state);

  svg.appendChild(createSvg("line", {
    x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y,
    stroke, "stroke-width": "24", "stroke-linecap": "round"
  }));
  svg.appendChild(createSvg("line", {
    x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
    stroke, "stroke-width": "20", "stroke-linecap": "round"
  }));
  svg.appendChild(createSvg("line", {
    x1: p2.x, y1: p2.y, x2: p3.x, y2: p3.y,
    stroke, "stroke-width": "16", "stroke-linecap": "round"
  }));

  for (const point of [p0, p1, p2, p3]) {
    svg.appendChild(createSvg("circle", {
      cx: point.x,
      cy: point.y,
      r: point === p0 ? "9" : "7",
      fill: "#fff4e8",
      stroke: "#7a4a2b",
      "stroke-width": "3"
    }));
  }

  svg.appendChild(createSvg("text", {
    x: p3.x,
    y: p3.y - 16,
    fill: "#473528",
    "font-size": "14",
    "font-weight": "700",
    "text-anchor": "middle"
  }, `${finger.name} ${finger.percent}%`));
}

function createSvg(tag, attributes, textContent = "") {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  if (textContent) {
    node.textContent = textContent;
  }
  return node;
}

function polarPoint(origin, length, angle) {
  return {
    x: origin.x + Math.cos(angle) * length,
    y: origin.y + Math.sin(angle) * length
  };
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function fingerColor(stateName) {
  if (stateName === "OPEN") return "#4a9f6d";
  if (stateName === "HALF") return "#d4931e";
  if (stateName === "BENT") return "#b24c2c";
  return "#7d6a58";
}

function stateClassName(stateName) {
  return `state-${String(stateName).toLowerCase()}`;
}

function displayState(stateName) {
  return String(stateName).replaceAll("_", " ");
}

function formatNumber(value) {
  return value === null || value === undefined ? "N/A" : String(value);
}

initialize();
