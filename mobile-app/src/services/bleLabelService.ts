/**
 * bleLabelService.ts
 *
 * BLE service for the FINAL smart-glove flow:
 *   Arduino sends  →  LABEL|Phrase|confidence|f1,f2,f3,f4,f5
 *   e.g.           →  HELLO|Hello|0.89|78,0,7,100,20
 *
 * This is separate from bleGloveService.ts (which handles raw sensor streaming).
 * The device name and UUIDs match the fake-BLE Arduino sketch below.
 */

import { BleManager } from "react-native-ble-plx";
import type { Device, Subscription } from "react-native-ble-plx";
import { decode as atob } from "base-64";
import { Platform } from "react-native";

// ── BLE UUIDs ─────────────────────────────────────────────────────────────────
// Must match the Arduino fake-BLE sketch exactly.
export const LABEL_BLE = {
  DEVICE_NAME: "SmartGlove5F",
  SERVICE_UUID:    "7c8f0010-7a6b-4c5d-9f2a-222222222222",
  LABEL_CHAR_UUID: "7c8f0011-7a6b-4c5d-9f2a-222222222222",
};

// ── Parsed label packet ───────────────────────────────────────────────────────
export interface GloveLabel {
  label:      string;   // e.g. "HELLO"
  phrase:     string;   // e.g. "Hello"
  confidence: number;   // e.g. 0.89
  fingers:    number[]; // e.g. [78, 0, 7, 100, 20]
  raw:        string;   // the original BLE string, for debugging
}

// ── Module-level state ────────────────────────────────────────────────────────
let bleInitError = "";
let manager: BleManager | null = null;

if (Platform.OS !== "web") {
  try {
    manager = new BleManager();
  } catch {
    bleInitError =
      "BLE native module unavailable. Use a custom Expo dev build (npx expo run:android).";
  }
}

let activeDevice: Device | null = null;
let labelSubscription: Subscription | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse  "HELLO|Hello|0.89|78,0,7,100,20"  →  GloveLabel */
export function parseLabelPacket(raw: string): GloveLabel | null {
  const parts = raw.trim().split("|");
  if (parts.length < 3) return null;

  const label      = parts[0].trim();
  const phrase     = parts[1].trim();
  const confidence = parseFloat(parts[2]);
  const fingers    = (parts[3] ?? "")
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => Number.isFinite(v));

  if (!label || isNaN(confidence)) return null;

  return { label, phrase, confidence, fingers, raw };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function scanForLabelGlove(
  onFound: (device: Device) => void,
  onError: (message: string) => void
) {
  if (!manager) {
    onError(bleInitError || "BLE is only available in the native build.");
    return;
  }

  manager.startDeviceScan(
    null, // scan all services — the fake sketch may not advertise a service UUID
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        onError(error.message);
        return;
      }
      if (device?.name?.includes(LABEL_BLE.DEVICE_NAME)) {
        manager!.stopDeviceScan();
        onFound(device);
      }
    }
  );
}

export function stopLabelScan() {
  manager?.stopDeviceScan();
}

export async function connectToLabelGlove(device: Device): Promise<Device> {
  if (!manager) {
    throw new Error(bleInitError || "BLE is only available in the native build.");
  }
  const connected   = await device.connect();
  const readyDevice = await connected.discoverAllServicesAndCharacteristics();
  activeDevice = readyDevice;
  return readyDevice;
}

export function startLabelStream(
  onLabel: (label: GloveLabel) => void,
  onError: (message: string) => void
) {
  if (!activeDevice) {
    onError("No glove connected.");
    return;
  }

  labelSubscription = activeDevice.monitorCharacteristicForService(
    LABEL_BLE.SERVICE_UUID,
    LABEL_BLE.LABEL_CHAR_UUID,
    (error, characteristic) => {
      if (error) {
        onError(error.message);
        return;
      }
      if (!characteristic?.value) return;

      const decoded = atob(characteristic.value);
      const parsed  = parseLabelPacket(decoded);
      if (parsed) onLabel(parsed);
    }
  );
}

export function stopLabelStream() {
  labelSubscription?.remove();
  labelSubscription = null;
}

export async function disconnectLabelGlove(): Promise<void> {
  stopLabelStream();
  if (activeDevice) {
    await activeDevice.cancelConnection();
    activeDevice = null;
  }
}
