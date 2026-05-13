import { BleManager, Device, Subscription } from "react-native-ble-plx";
import { decode as atob, encode as btoa } from "base-64";

export const SMART_GLOVE_BLE = {
  SERVICE_UUID: "7c8f0001-7a6b-4c5d-9f2a-111111111111",
  SAMPLE_UUID: "7c8f0002-7a6b-4c5d-9f2a-111111111111",
  CONTROL_UUID: "7c8f0003-7a6b-4c5d-9f2a-111111111111",
  STATUS_UUID: "7c8f0004-7a6b-4c5d-9f2a-111111111111"
};

const manager = new BleManager();

let activeDevice: Device | null = null;
let sampleSubscription: Subscription | null = null;

export type GloveSample = number[];

export function scanForGlove(
  onFound: (device: Device) => void,
  onError: (message: string) => void
) {
  manager.startDeviceScan(
    [SMART_GLOVE_BLE.SERVICE_UUID],
    null,
    (error, device) => {
      if (error) {
        onError(error.message);
        return;
      }

      if (device?.name?.includes("SmartGlove")) {
        manager.stopDeviceScan();
        onFound(device);
      }
    }
  );
}

export async function connectToGlove(device: Device): Promise<Device> {
  const connected = await device.connect();
  const readyDevice = await connected.discoverAllServicesAndCharacteristics();

  activeDevice = readyDevice;

  return readyDevice;
}

export async function startGloveStream(
  onSample: (sample: GloveSample) => void,
  onError: (message: string) => void
): Promise<void> {
  if (!activeDevice) {
    throw new Error("No glove connected.");
  }

  await activeDevice.writeCharacteristicWithResponseForService(
    SMART_GLOVE_BLE.SERVICE_UUID,
    SMART_GLOVE_BLE.CONTROL_UUID,
    btoa("START")
  );

  sampleSubscription = activeDevice.monitorCharacteristicForService(
    SMART_GLOVE_BLE.SERVICE_UUID,
    SMART_GLOVE_BLE.SAMPLE_UUID,
    (error, characteristic) => {
      if (error) {
        onError(error.message);
        return;
      }

      if (!characteristic?.value) return;

      const decoded = atob(characteristic.value);
      const sample = decoded
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value));

      if (sample.length === 5) {
        onSample(sample);
      }
    }
  );
}

export async function stopGloveStream(): Promise<void> {
  if (!activeDevice) return;

  sampleSubscription?.remove();
  sampleSubscription = null;

  await activeDevice.writeCharacteristicWithResponseForService(
    SMART_GLOVE_BLE.SERVICE_UUID,
    SMART_GLOVE_BLE.CONTROL_UUID,
    btoa("STOP")
  );
}

export async function disconnectGlove(): Promise<void> {
  sampleSubscription?.remove();
  sampleSubscription = null;

  if (activeDevice) {
    await activeDevice.cancelConnection();
    activeDevice = null;
  }
}
