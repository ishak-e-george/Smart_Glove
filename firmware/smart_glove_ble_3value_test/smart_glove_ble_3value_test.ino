// Smart Glove: BLE 3-Value Test Proof of Concept
// Board: Arduino Nano 33 BLE Rev2
//
// Sends faked 3-finger percentage values: index_percent,middle_percent,ring_percent
// Used to test mobile connection and UI responsiveness before full sensor integration.

#include <ArduinoBLE.h>

const char* SERVICE_UUID = "7c8f0001-7a6b-4c5d-9f2a-111111111111";
const char* SAMPLE_UUID  = "7c8f0002-7a6b-4c5d-9f2a-111111111111";

BLEService gloveService(SERVICE_UUID);

// String characteristic to support notify streams
BLEStringCharacteristic sampleCharacteristic(
  SAMPLE_UUID,
  BLERead | BLENotify,
  80
);

unsigned long lastSampleMs = 0;
const unsigned long SAMPLE_INTERVAL_MS = 150; // Notification stream interval

int testIndexPercent = 0;
int testMiddlePercent = 0;
int testRingPercent = 0;

bool wasConnected = false;

void setup() {
  Serial.begin(115200);

  // Non-blocking serial connection wait (3-second timeout) for battery power tests
  unsigned long startWait = millis();
  while (!Serial && (millis() - startWait < 3000)) {
    delay(10);
  }

  Serial.println();
  Serial.println("# Smart Glove BLE 3-Value Test");
  Serial.println("# Board : Arduino Nano 33 BLE Rev2");
  Serial.println("# ----------------------------------------");
  Serial.print("# Device name     : "); Serial.println("SmartGlove3F");
  Serial.print("# Service UUID    : "); Serial.println(SERVICE_UUID);
  Serial.print("# Char UUID       : "); Serial.println(SAMPLE_UUID);
  Serial.println("# Payload format  : index_percent,middle_percent,ring_percent");
  Serial.println("# Notify interval : 150 ms");
  Serial.println("# ----------------------------------------");

  if (!BLE.begin()) {
    Serial.println("# BLE failed to start");
    while (1);
  }

  BLE.setLocalName("SmartGlove3F");
  BLE.setAdvertisedService(gloveService);

  gloveService.addCharacteristic(sampleCharacteristic);
  BLE.addService(gloveService);

  sampleCharacteristic.writeValue("0,0,0");

  BLE.advertise();
  Serial.println("# Waiting for central to connect...");
}

void loop() {
  // 1. Poll BLE stack events unconditionally at the very top of loop
  // This ensures advertising-phase events are handled immediately
  BLE.poll();

  // 2. Check if a central device is actively connected
  BLEDevice central = BLE.central();

  if (central) {
    if (!wasConnected) {
      Serial.print("# Connected: ");
      Serial.println(central.address());
      Serial.println("# Streaming notifications...");
      wasConnected = true;
    }

    unsigned long currentMillis = millis();
    if (currentMillis - lastSampleMs >= SAMPLE_INTERVAL_MS) {
      lastSampleMs = currentMillis;

      // Sweep index finger from 0 -> 25 -> 50 -> 75 -> 100 -> 0
      testIndexPercent += 25;
      if (testIndexPercent > 100) {
        testIndexPercent = 0;
      }

      // Middle and Ring stay static for the initial connection test
      testMiddlePercent = 0;
      testRingPercent = 0;

      // Build payload using snprintf to avoid heap fragmentation from String object creation
      char payload[32];
      snprintf(payload, sizeof(payload), "%d,%d,%d", testIndexPercent, testMiddlePercent, testRingPercent);

      // Write value and trigger notification to subscribers
      sampleCharacteristic.writeValue(payload);

      // Print clean CSV locally to Serial
      Serial.println(payload);
    }
  } else {
    // Detect disconnect
    if (wasConnected) {
      Serial.println("# Disconnected. Re-advertising...");
      // Explicitly re-advertise since ArduinoBLE does not auto-resume advertising on disconnect
      BLE.advertise();
      Serial.println("# Waiting for central to connect...");
      wasConnected = false;
    }
  }
}
