/**
 * fake_ble_label_sender.ino
 * Board: Arduino Nano 33 BLE Rev2
 *
 * PURPOSE: Test milestone — prove the BLE → Mobile App → Speech pipeline
 *          works BEFORE moving the real AI model onto Arduino.
 *
 * What it does:
 *   • Advertises as "SmartGlove" over BLE
 *   • Every 3 seconds sends a fake label packet on the label characteristic
 *   • Cycles through a list of ASL gestures so you can see each one appear
 *     on the phone and hear the phone speak it
 *
 * Packet format (matches bleLabelService.ts exactly):
 *   "LABEL|Phrase|confidence|f1,f2,f3,f4,f5"
 *   e.g. "HELLO|Hello|0.89|78,0,7,100,20"
 *
 * UUIDs (must match bleLabelService.ts):
 *   Service:  7c8f0010-7a6b-4c5d-9f2a-222222222222
 *   Label:    7c8f0011-7a6b-4c5d-9f2a-222222222222
 *
 * ── WIRING ───────────────────────────────────────────────────────────────────
 * No extra wiring needed — this sketch only uses BLE, not sensors.
 * Connect the board via USB to upload, then disconnect from USB and
 * power via battery (or keep USB connected — BLE works either way).
 *
 * ── HOW TO TEST ──────────────────────────────────────────────────────────────
 * 1. Upload this sketch to your Nano 33 BLE Rev2
 * 2. Open Serial Monitor @ 115200 to see what is being sent
 * 3. Open the mobile app → tap "BLE Label Mode" → tap "Scan for Glove"
 * 4. Watch the label appear on screen and the phone speak it
 * 5. Every 3 seconds a new gesture fires automatically
 *
 * ── NEXT STEP (after this works) ─────────────────────────────────────────────
 * Replace the fake_labels[] table with real RandomForest inference so the
 * Arduino classifies gestures from your flex sensors and sends real results.
 */

#include <ArduinoBLE.h>

// ── BLE UUIDs — must match bleLabelService.ts exactly ─────────────────────────
#define SERVICE_UUID    "7c8f0010-7a6b-4c5d-9f2a-222222222222"
#define LABEL_CHAR_UUID "7c8f0011-7a6b-4c5d-9f2a-222222222222"

// ── BLE objects ───────────────────────────────────────────────────────────────
BLEService         gloveService(SERVICE_UUID);
BLEStringCharacteristic labelChar(
  LABEL_CHAR_UUID,
  BLERead | BLENotify,
  64            // max packet length in bytes
);

// ── Fake gesture table ────────────────────────────────────────────────────────
// Format: "LABEL|Phrase|confidence|thumb,index,middle,ring,pinky"
// Finger values are 0-100 (0 = flat, 100 = fully curled)
const char* fake_labels[] = {
  "HELLO|Hello|0.92|10,5,3,4,6",
  "THANKS|Thank you|0.88|20,90,85,80,75",
  "YES|Yes|0.95|5,95,0,0,0",
  "NO|No|0.91|8,80,80,0,0",
  "HELP|Help|0.85|15,10,0,0,0",
  "WATER|Water|0.79|12,95,90,0,0",
  "FOOD|Food|0.83|18,85,80,75,0",
  "SORRY|Sorry|0.87|22,0,0,0,0",
  "PLEASE|Please|0.90|30,95,90,85,80",
  "LOVE|I love you|0.94|8,0,0,0,90",
};
const int LABEL_COUNT = sizeof(fake_labels) / sizeof(fake_labels[0]);

int  labelIndex     = 0;
bool centralConnected = false;

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  while (!Serial);     // wait for Serial Monitor (remove this line for battery use)

  Serial.println("=== Fake BLE Label Sender ===");
  Serial.println("Board: Arduino Nano 33 BLE Rev2");
  Serial.println();

  // Onboard LED shows BLE state
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  // Init BLE
  if (!BLE.begin()) {
    Serial.println("ERROR: BLE init failed! Check board selection.");
    while (true) {
      digitalWrite(LED_BUILTIN, HIGH); delay(200);
      digitalWrite(LED_BUILTIN, LOW);  delay(200);
    }
  }

  // Advertise as "SmartGlove5F" — matches the name the phone scans for
  BLE.setLocalName("SmartGlove5F");
  BLE.setAdvertisedService(gloveService);

  // Add characteristic to service, service to BLE
  gloveService.addCharacteristic(labelChar);
  BLE.addService(gloveService);

  // Write an initial value so the characteristic exists
  labelChar.writeValue("READY|Ready|1.00|0,0,0,0,0");

  BLE.advertise();
  Serial.println("BLE advertising as 'SmartGlove5F'");
  Serial.println("Waiting for phone connection...");
  Serial.println();
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  BLEDevice central = BLE.central();

  if (central) {
    if (!centralConnected) {
      centralConnected = true;
      digitalWrite(LED_BUILTIN, HIGH);
      Serial.print("Connected to: ");
      Serial.println(central.address());
      Serial.println("Sending a label every 3 seconds...");
      Serial.println();
    }

    while (central.connected()) {
      // Send next fake label
      const char* packet = fake_labels[labelIndex];
      labelChar.writeValue(packet);

      Serial.print("[TX] ");
      Serial.println(packet);

      labelIndex = (labelIndex + 1) % LABEL_COUNT;

      delay(3000);  // 3-second interval — adjust as needed
    }

    // Disconnected
    centralConnected = false;
    digitalWrite(LED_BUILTIN, LOW);
    Serial.println();
    Serial.println("Phone disconnected. Waiting for reconnect...");
  }
}
