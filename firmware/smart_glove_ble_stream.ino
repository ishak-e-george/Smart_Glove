#include <ArduinoBLE.h>

const char* SERVICE_UUID = "7c8f0001-7a6b-4c5d-9f2a-111111111111";
const char* SAMPLE_UUID  = "7c8f0002-7a6b-4c5d-9f2a-111111111111";
const char* CONTROL_UUID = "7c8f0003-7a6b-4c5d-9f2a-111111111111";
const char* STATUS_UUID  = "7c8f0004-7a6b-4c5d-9f2a-111111111111";

BLEService gloveService(SERVICE_UUID);

BLEStringCharacteristic sampleCharacteristic(
  SAMPLE_UUID,
  BLERead | BLENotify,
  80
);

BLEStringCharacteristic controlCharacteristic(
  CONTROL_UUID,
  BLEWrite,
  20
);

BLEStringCharacteristic statusCharacteristic(
  STATUS_UUID,
  BLERead | BLENotify,
  40
);

const int FLEX_PINS[5] = {A0, A1, A2, A3, A4};

bool streaming = false;
unsigned long lastSampleMs = 0;
const unsigned long SAMPLE_INTERVAL_MS = 20; // 50Hz

void setup() {
  Serial.begin(115200);

  analogReadResolution(12);

  if (!BLE.begin()) {
    Serial.println("BLE failed to start");
    while (1);
  }

  BLE.setLocalName("SmartGlove-001");
  BLE.setAdvertisedService(gloveService);

  gloveService.addCharacteristic(sampleCharacteristic);
  gloveService.addCharacteristic(controlCharacteristic);
  gloveService.addCharacteristic(statusCharacteristic);

  BLE.addService(gloveService);

  statusCharacteristic.writeValue("READY");
  sampleCharacteristic.writeValue("0,0,0,0,0");

  BLE.advertise();

  Serial.println("Smart Glove BLE is advertising...");
}

void loop() {
  BLEDevice central = BLE.central();

  if (central) {
    Serial.print("Connected to: ");
    Serial.println(central.address());

    statusCharacteristic.writeValue("CONNECTED");

    while (central.connected()) {
      BLE.poll();

      if (controlCharacteristic.written()) {
        String command = controlCharacteristic.value();

        command.trim();
        command.toUpperCase();

        if (command == "START") {
          streaming = true;
          statusCharacteristic.writeValue("STREAMING");
          Serial.println("Streaming started");
        }

        if (command == "STOP") {
          streaming = false;
          statusCharacteristic.writeValue("STOPPED");
          Serial.println("Streaming stopped");
        }
      }

      if (streaming && millis() - lastSampleMs >= SAMPLE_INTERVAL_MS) {
        lastSampleMs = millis();

        int s0 = analogRead(FLEX_PINS[0]);
        int s1 = analogRead(FLEX_PINS[1]);
        int s2 = analogRead(FLEX_PINS[2]);
        int s3 = analogRead(FLEX_PINS[3]);
        int s4 = analogRead(FLEX_PINS[4]);

        String line =
          String(s0) + "," +
          String(s1) + "," +
          String(s2) + "," +
          String(s3) + "," +
          String(s4);

        sampleCharacteristic.writeValue(line);

        Serial.println(line);
      }
    }

    streaming = false;
    statusCharacteristic.writeValue("READY");

    Serial.println("Disconnected");
  }
}
