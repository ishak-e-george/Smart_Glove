import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const fingerOrder = ["INDEX", "MIDDLE", "RING"];
const GLOVE_WS_URL = "ws://127.0.0.1:8765";
const DEMO_MODE = "websocket";
const DEMO_PHRASES = {
  INDEX_BENT: "Hello, my name is George",
  MIDDLE_BENT: "No, thank you",
  BOTH_BENT: "I am hungry",
  INDEX_HALF: "Water",
  RING_BENT: "I need help"
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

function formatValue(value) {
  return value === null || value === undefined ? "N/A" : String(value);
}

function normalizeState(value) {
  return String(value || "UNCALIBRATED").trim().replace(/\s+/g, "_").toUpperCase();
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

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function chipClass(stateName) {
  return String(stateName).toLowerCase();
}

function displayState(stateName) {
  return String(stateName).replaceAll("_", " ");
}

function fingerColor(stateName) {
  if (stateName === "OPEN") return "#2f8b61";
  if (stateName === "HALF") return "#c98924";
  if (stateName === "BENT") return "#aa4e2f";
  return "#8d7a67";
}

function useSerialFeed() {
  const [serialSupported] = useState("serial" in navigator);
  const [status, setStatus] = useState(serialSupported ? "Idle" : "Web Serial unavailable");
  const [portLabel, setPortLabel] = useState("Not selected");
  const [frameCount, setFrameCount] = useState(0);
  const [parserMode, setParserMode] = useState("Waiting");
  const [lastError, setLastError] = useState("None");
  const [consoleLines, setConsoleLines] = useState(["Waiting for serial data..."]);
  const [fingers, setFingers] = useState({
    INDEX: createFingerState("INDEX"),
    MIDDLE: createFingerState("MIDDLE"),
    RING: createFingerState("RING")
  });

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const inputClosedRef = useRef(null);
  const keepReadingRef = useRef(false);

  const appendConsole = (line) => {
    setConsoleLines((current) => {
      const next = [...current, line];
      return next.slice(-40);
    });
  };

  const parseVisualizerLine = (line) => {
    const parts = line.split(",");
    if (parts.length < 16) {
      return false;
    }

    const mapped = [
      { name: "INDEX", base: 1 },
      { name: "MIDDLE", base: 6 },
      { name: "RING", base: 11 }
    ];

    setFingers((current) => {
      const next = { ...current };
      for (const finger of mapped) {
        next[finger.name] = {
          ...next[finger.name],
          smooth: parseMaybeNumber(parts[finger.base]),
          percent: clampPercent(parseMaybeNumber(parts[finger.base + 1])),
          state: normalizeState(parts[finger.base + 2]),
          range: parseMaybeNumber(parts[finger.base + 3]),
          quality: (parts[finger.base + 4] || "N/A").trim()
        };
      }
      return next;
    });

    setParserMode("VIS compact");
    setFrameCount((count) => count + 1);
    return true;
  };

  const parseTwoFingerCsvLine = (line) => {
    const parts = line.split(",");
    if (parts.length !== 6) {
      return false;
    }

    const values = parts.map((part) => Number(part.trim()));
    if (values.some((value) => !Number.isFinite(value))) {
      return false;
    }

    const [indexRaw, indexSmooth, indexPercent, middleRaw, middleSmooth, middlePercent] = values;

    setFingers((current) => ({
      ...current,
      INDEX: {
        ...current.INDEX,
        raw: indexRaw,
        smooth: indexSmooth,
        percent: clampPercent(indexPercent),
        state: normalizeState(indexPercent < 25 ? "OPEN" : indexPercent < 65 ? "HALF" : "BENT"),
        warning: ""
      },
      MIDDLE: {
        ...current.MIDDLE,
        raw: middleRaw,
        smooth: middleSmooth,
        percent: clampPercent(middlePercent),
        state: normalizeState(middlePercent < 25 ? "OPEN" : middlePercent < 65 ? "HALF" : "BENT"),
        warning: ""
      },
      RING: {
        ...current.RING,
        raw: null,
        smooth: null,
        percent: 0,
        state: "NOT_USED",
        warning: "Not used in 2-finger mode"
      }
    }));

    setParserMode("2-finger CSV");
    setFrameCount((count) => count + 1);
    return true;
  };

  const parseDashboardLine = (line) => {
    const warningMatch = line.split("<--");
    const content = warningMatch[0].trim();
    const warning = warningMatch[1] ? warningMatch[1].trim() : "";
    const parts = content.split("|").map((part) => part.trim());
    const name = parts.shift();

    if (!name || !fingerOrder.includes(name)) {
      return false;
    }

    setFingers((current) => {
      const next = { ...current };
      const record = { ...next[name], warning };

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

      next[name] = record;
      return next;
    });

    setParserMode("Dashboard");
    setFrameCount((count) => count + 1);
    return true;
  };

  const handleLine = (line) => {
    if (!line) {
      return;
    }
    appendConsole(line);
    if (line.startsWith("#")) {
      return;
    }
    if (parseTwoFingerCsvLine(line)) {
      return;
    }
    if (line.startsWith("VIS,")) {
      parseVisualizerLine(line);
      return;
    }
    if (fingerOrder.some((fingerName) => line.startsWith(fingerName))) {
      parseDashboardLine(line);
    }
  };

  const disconnect = async () => {
    keepReadingRef.current = false;

    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
    } catch (error) {
      appendConsole(`Reader cancel error: ${error.message}`);
    }

    try {
      if (inputClosedRef.current) {
        await inputClosedRef.current.catch(() => {});
      }
    } catch (error) {
      appendConsole(`Input close error: ${error.message}`);
    }

    try {
      if (portRef.current) {
        await portRef.current.close();
      }
    } catch (error) {
      appendConsole(`Port close error: ${error.message}`);
    }

    portRef.current = null;
    readerRef.current = null;
    inputClosedRef.current = null;
    setStatus("Disconnected");
    setPortLabel("Not selected");
  };

  const connect = async () => {
    if (!serialSupported) {
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      keepReadingRef.current = true;
      setStatus("Connected");
      setPortLabel("USB Serial @ 115200");
      setLastError("None");
      appendConsole("Serial port opened.");

      const textDecoder = new TextDecoderStream();
      inputClosedRef.current = port.readable.pipeTo(textDecoder.writable);
      const inputStream = textDecoder.readable;
      const reader = inputStream.getReader();
      readerRef.current = reader;

      let buffer = "";

      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
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
      setStatus("Connection failed");
      setLastError(error?.message || String(error));
      appendConsole(`Connect error: ${error?.message || String(error)}`);
    } finally {
      if (readerRef.current) {
        readerRef.current.releaseLock();
        readerRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      disconnect().catch(() => {});
    };
  }, []);

  return {
    serialSupported,
    status,
    portLabel,
    frameCount,
    parserMode,
    lastError,
    consoleLines,
    fingers,
    connect,
    disconnect
  };
}

function useGloveSpeechFeed() {
  const [connected, setConnected] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speechSupported] = useState(Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance));
  const [voiceReady, setVoiceReady] = useState(false);
  const [lastGesture, setLastGesture] = useState("");
  const [lastWord, setLastWord] = useState("");
  const [lastSpokenWord, setLastSpokenWord] = useState("");
  const [detectedCount, setDetectedCount] = useState(0);
  const [logs, setLogs] = useState([]);

  const socketRef = useRef(null);
  const voiceEnabledRef = useRef(false);
  const selectedVoiceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const lastDisplayedWordRef = useRef("");

  const addLog = (message) => {
    setLogs((current) => {
      const line = `${new Date().toLocaleTimeString()} - ${message}`;
      return [line, ...current].slice(0, 10);
    });
  };

  const speak = (text) => {
    if (!speechSupported) {
      addLog("Speech synthesis is not supported in this browser");
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
    }
    utterance.onstart = () => {
      setLastSpokenWord(text);
      addLog(`Speaking: ${text}`);
    };
    utterance.onerror = (event) => {
      const errorCode = event.error || "unknown";
      if (errorCode === "interrupted") {
        return;
      }
      addLog(`Speech error: ${errorCode}`);
    };
    synth.speak(utterance);
  };

  const enableVoice = () => {
    setVoiceEnabled(true);
    addLog("Voice enabled");
    speak("Voice enabled");
  };

  const testVoice = () => {
    speak("Testing smart glove voice");
  };

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    if (!speechSupported) {
      return undefined;
    }

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const voices = synth.getVoices();
      if (!voices.length) {
        setVoiceReady(false);
        return;
      }

      selectedVoiceRef.current =
        voices.find((voice) => /en/i.test(voice.lang)) ||
        voices.find((voice) => voice.default) ||
        voices[0];
      setVoiceReady(true);
      addLog(`Voice ready: ${selectedVoiceRef.current?.name || "default"}`);
    };

    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
    };
  }, [speechSupported]);

  useEffect(() => {
    let isActive = true;

    const connectSocket = () => {
      if (!isActive) {
        return;
      }

      const socket = new WebSocket(GLOVE_WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        addLog("Connected to glove WebSocket");
      };

      socket.onclose = () => {
        setConnected(false);
        addLog("Disconnected from glove WebSocket");
        if (isActive) {
          reconnectTimerRef.current = window.setTimeout(connectSocket, 1500);
        }
      };

      socket.onerror = () => {
        addLog("WebSocket error");
      };

      socket.onmessage = (event) => {
        try {
        const data = JSON.parse(event.data);
        const gesture = data.gesture || "";
        const word = data.word || "";
        const spokenPhrase = DEMO_PHRASES[gesture] || word;

        setLastGesture(gesture);
        setLastWord(spokenPhrase);

        if (!spokenPhrase) {
          return;
        }

        if (spokenPhrase !== lastDisplayedWordRef.current) {
          lastDisplayedWordRef.current = spokenPhrase;
          setDetectedCount((count) => count + 1);
          addLog(`Detected phrase: ${spokenPhrase}`);
        }

        if (spokenPhrase && voiceEnabledRef.current) {
          speak(spokenPhrase);
        }
      } catch (error) {
        addLog("Invalid message from glove server");
      }
      };
    };

    connectSocket();
    return () => {
      isActive = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      socketRef.current = null;
    };
  }, []);

  return {
    connected,
    voiceEnabled,
    speechSupported,
    voiceReady,
    lastGesture,
    lastWord,
    lastSpokenWord,
    detectedCount,
    logs,
    enableVoice,
    testVoice
  };
}

function FingerTelemetry({ finger }) {
  return (
    React.createElement("article", { className: "finger-card" },
      React.createElement("div", { className: "finger-head" },
        React.createElement("h3", null, finger.name),
        React.createElement("span", { className: `chip ${chipClass(finger.state)}` }, displayState(finger.state))
      ),
      React.createElement("div", { className: "meter-line" },
        React.createElement("span", null, "Curl"),
        React.createElement("div", { className: "track" },
          React.createElement("div", { className: "fill", style: { width: `${finger.percent}%` } })
        ),
        React.createElement("strong", null, `${finger.percent}%`)
      ),
      React.createElement("div", { className: "grid" },
        React.createElement("div", null, "Raw", React.createElement("strong", null, formatValue(finger.raw))),
        React.createElement("div", null, "Smooth", React.createElement("strong", null, formatValue(finger.smooth))),
        React.createElement("div", null, "Flat", React.createElement("strong", null, formatValue(finger.flat))),
        React.createElement("div", null, "Curl", React.createElement("strong", null, formatValue(finger.curl))),
        React.createElement("div", null, "Range", React.createElement("strong", null, formatValue(finger.range))),
        React.createElement("div", null, "Quality", React.createElement("strong", null, finger.quality))
      ),
      React.createElement("div", { className: "warning" }, finger.warning || "No warning")
    )
  );
}

function FingerSegment({ length, thickness, color, positionZ }) {
  return React.createElement(RoundedBox, {
    args: [thickness, thickness * 0.82, length],
    radius: 0.12,
    smoothness: 4,
    position: [0, 0, positionZ]
  },
    React.createElement("meshStandardMaterial", {
      color,
      roughness: 0.48,
      metalness: 0.08
    })
  );
}

function FingerRig({ basePosition, spread, percent, color }) {
  const baseRef = useRef();
  const midRef = useRef();
  const tipRef = useRef();

  const curl = useMemo(() => THREE.MathUtils.degToRad(6 + percent * 0.78), [percent]);

  useEffect(() => {
    if (!baseRef.current || !midRef.current || !tipRef.current) {
      return;
    }

    baseRef.current.rotation.x = -curl * 0.32;
    baseRef.current.rotation.z = spread;
    midRef.current.rotation.x = -curl * 0.38;
    tipRef.current.rotation.x = -curl * 0.44;
  }, [curl, spread]);

  return (
    React.createElement("group", { position: basePosition },
      React.createElement("group", { ref: baseRef },
        React.createElement(FingerSegment, { length: 2.25, thickness: 0.62, color, positionZ: 1.1 }),
        React.createElement("group", { ref: midRef, position: [0, 0, 2.2] },
          React.createElement(FingerSegment, { length: 1.65, thickness: 0.54, color, positionZ: 0.82 }),
          React.createElement("group", { ref: tipRef, position: [0, 0, 1.66] },
            React.createElement(FingerSegment, { length: 1.2, thickness: 0.46, color, positionZ: 0.6 })
          )
        )
      )
    )
  );
}

function HandModel({ fingers }) {
  const data = useMemo(() => ({
    INDEX: { position: [-1.45, 0.3, -0.2], spread: 0.24 },
    MIDDLE: { position: [0, 0.48, 0], spread: 0 },
    RING: { position: [1.4, 0.2, 0.15], spread: -0.18 }
  }), []);

  return (
    React.createElement("group", { rotation: [0.45, -0.55, -0.2], position: [0, -1, 0] },
      React.createElement(RoundedBox, {
        args: [4.5, 1.35, 4.3],
        radius: 0.34,
        smoothness: 4,
        position: [0, -0.7, 0]
      },
        React.createElement("meshStandardMaterial", {
          color: "#e2b082",
          roughness: 0.55,
          metalness: 0.05
        })
      ),
      React.createElement(RoundedBox, {
        args: [3.2, 1.0, 1.3],
        radius: 0.26,
        smoothness: 4,
        position: [0, -1.55, -1.2]
      },
        React.createElement("meshStandardMaterial", {
          color: "#c48d60",
          roughness: 0.58
        })
      ),
      fingerOrder.map((name) => React.createElement(FingerRig, {
        key: name,
        basePosition: data[name].position,
        spread: data[name].spread,
        percent: fingers[name].percent,
        color: fingerColor(fingers[name].state)
      }))
    )
  );
}

function Scene({ fingers }) {
  return (
    React.createElement(Canvas, { camera: { position: [0, 2.5, 11], fov: 34 } },
      React.createElement("color", { attach: "background", args: ["#f3e8db"] }),
      React.createElement("ambientLight", { intensity: 1.1 }),
      React.createElement("directionalLight", { position: [6, 8, 5], intensity: 2.2, castShadow: false }),
      React.createElement("directionalLight", { position: [-5, 4, -6], intensity: 0.8, castShadow: false }),
      React.createElement("mesh", { rotation: [-Math.PI / 2, 0, 0], position: [0, -3.3, 0] },
        React.createElement("circleGeometry", { args: [8, 64] }),
        React.createElement("meshStandardMaterial", { color: "#d8c1a8", roughness: 0.9 })
      ),
      React.createElement(HandModel, { fingers }),
      React.createElement(Environment, { preset: "warehouse" }),
      React.createElement(OrbitControls, {
        enablePan: false,
        minDistance: 7,
        maxDistance: 16,
        minPolarAngle: 0.7,
        maxPolarAngle: 2.2
      })
    )
  );
}

function GloveSpeechPanel() {
  const {
    connected,
    voiceEnabled,
    speechSupported,
    voiceReady,
    lastGesture,
    lastWord,
    lastSpokenWord,
    detectedCount,
    logs,
    enableVoice,
    testVoice
  } = useGloveSpeechFeed();

  return (
    React.createElement("article", { className: "panel speech-panel" },
      React.createElement("div", { className: "panel-header" },
        React.createElement("div", null,
          React.createElement("p", { className: "label" }, "Gesture Speech"),
          React.createElement("h2", null, "Word Output")
        )
      ),
      React.createElement("div", { className: "speech-status" },
        React.createElement("div", { className: "speech-row" },
          React.createElement("span", null, "Connection Status"),
          React.createElement("strong", { className: connected ? "ok-text" : "bad-text" }, connected ? "Connected" : "Disconnected")
        ),
        React.createElement("div", { className: "speech-row" },
          React.createElement("span", null, "Speech Status"),
          React.createElement("strong", null, voiceEnabled ? "Enabled" : "Disabled")
        ),
        React.createElement("div", { className: "speech-row" },
          React.createElement("span", null, "Speech Engine"),
          React.createElement("strong", { className: speechSupported && voiceReady ? "ok-text" : "bad-text" }, speechSupported && voiceReady ? "Ready" : "Not ready")
        )
      ),
      !voiceEnabled && React.createElement("button", {
        className: "primary wide-button",
        onClick: enableVoice
      }, "Enable Laptop Voice"),
      voiceEnabled && React.createElement("button", {
        className: "secondary wide-button",
        onClick: testVoice
      }, "Test Voice"),
      React.createElement("div", { className: "speech-output" },
        React.createElement("p", null,
          React.createElement("strong", null, "Last Gesture: "),
          lastGesture || "-"
        ),
        React.createElement("p", null,
          React.createElement("strong", null, "Last Phrase: "),
          lastWord || "-"
        ),
        React.createElement("p", null,
          React.createElement("strong", null, "Last Spoken: "),
          lastSpokenWord || "-"
        ),
        React.createElement("p", null,
          React.createElement("strong", null, "Detected Count: "),
          String(detectedCount)
        )
      ),
      React.createElement("div", { className: "speech-hint" },
        "Keep ws_predict.py running locally. This browser panel speaks accepted phrases, ignores REST, and limits rapid repeats for a cleaner demo."
      ),
      React.createElement("div", { className: "speech-logs" },
        logs.length
          ? logs.map((log, index) => React.createElement("div", { key: index, className: "speech-log-item" }, log))
          : React.createElement("div", { className: "speech-log-item" }, "Waiting for glove events...")
      )
    )
  );
}

function App() {
  const {
    serialSupported,
    status,
    portLabel,
    frameCount,
    parserMode,
    lastError,
    consoleLines,
    fingers,
    connect,
    disconnect
  } = useSerialFeed();

  const serialControlsEnabled = DEMO_MODE !== "websocket";

  return (
    React.createElement("main", { className: "app-shell" },
      React.createElement("section", { className: "hero" },
        React.createElement("div", null,
          React.createElement("p", { className: "eyebrow" }, "Smart Glove"),
          React.createElement("h1", null, "Smart Glove Communication Demo"),
          React.createElement("p", { className: "hero-copy" },
            serialControlsEnabled
              ? "This browser interface can read the Arduino USB serial stream directly and show live finger telemetry."
              : "This browser interface runs in WebSocket demo mode. Python owns the glove serial port, and the browser only shows live spoken-word output and visualization."
          )
        ),
        serialControlsEnabled
          ? React.createElement("div", { className: "actions" },
            React.createElement("button", {
              className: "primary",
              onClick: connect,
              disabled: !serialSupported
            }, "Connect Serial"),
            React.createElement("button", {
              className: "secondary",
              onClick: disconnect
            }, "Disconnect")
          )
          : React.createElement("div", { className: "mode-banner" },
            React.createElement("strong", null, "WebSocket Demo Mode"),
            React.createElement("span", null, "Keep ws_predict.py running. Do not connect serial from the browser.")
          )
      ),
      React.createElement("section", { className: "stats" },
        React.createElement("article", { className: "stat-card" },
          React.createElement("p", { className: "label" }, serialControlsEnabled ? "Connection" : "Serial Mode"),
          React.createElement("strong", null, status)
        ),
        React.createElement("article", { className: "stat-card" },
          React.createElement("p", { className: "label" }, "Port"),
          React.createElement("strong", null, serialControlsEnabled ? portLabel : "Python owns COM port")
        ),
        React.createElement("article", { className: "stat-card" },
          React.createElement("p", { className: "label" }, "Frames"),
          React.createElement("strong", null, frameCount)
        ),
        React.createElement("article", { className: "stat-card" },
          React.createElement("p", { className: "label" }, "Parser"),
          React.createElement("strong", null, parserMode)
        ),
        React.createElement("article", { className: "stat-card" },
          React.createElement("p", { className: "label" }, "Last Error"),
          React.createElement("strong", { className: status === "Connection failed" ? "bad-text" : null }, lastError)
        )
      ),
      React.createElement("section", { className: "main-grid" },
        React.createElement("article", { className: "panel" },
          React.createElement("div", { className: "panel-header" },
            React.createElement("div", null,
              React.createElement("p", { className: "label" }, "3D Model"),
              React.createElement("h2", null, "Live Hand Pose")
            )
          ),
          React.createElement("div", { className: "canvas-wrap" },
            React.createElement(Scene, { fingers })
          )
        ),
        React.createElement("article", { className: "panel" },
          React.createElement("div", { className: "panel-header" },
            React.createElement("div", null,
              React.createElement("p", { className: "label" }, "Telemetry"),
              React.createElement("h2", null, "Finger Status")
            )
          ),
          React.createElement("div", { className: "cards" },
            fingerOrder.map((name) => React.createElement(FingerTelemetry, {
              key: name,
              finger: fingers[name]
            }))
          )
        )
      ),
      React.createElement("section", { className: "speech-grid" },
        React.createElement(GloveSpeechPanel, null)
      ),
      React.createElement("section", { className: "panel console" },
        React.createElement("div", { className: "panel-header" },
          React.createElement("div", null,
            React.createElement("p", { className: "label" }, "Serial Feed"),
            React.createElement("h2", null, "Latest Lines")
          )
        ),
        React.createElement("pre", null, consoleLines.join("\n"))
      )
    )
  );
}

createRoot(document.getElementById("root")).render(React.createElement(App));
