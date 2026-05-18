// Smart Glove: 2-Finger Persistent Calibration + AI Telemetry
// Board: Arduino Nano 33 BLE Rev2
//
// Pins:
// A0 = Index
// A1 = Middle
//
// Commands:
// f  or fa = save FLAT for both fingers
// c  or ca = save CURL for both fingers
// f1      = save FLAT for index
// c1      = save CURL for index
// f2      = save FLAT for middle
// c2      = save CURL for middle
// r       = reset all calibration
// r1/r2   = reset one finger
// h       = print calibration help/status
//
// Stream format:
// indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent

#include "kvstore_global_api.h"

const int SERIAL_SPEED = 115200;
const int READ_DELAY_MS = 120;
const int WINDOW_SIZE = 10;
const int CALIBRATION_SAMPLE_COUNT = 80;
const int CALIBRATION_SETTLE_MS = 300;

const int MIN_USABLE_RANGE = 50;
const int GOOD_RANGE = 150;
const int VERY_GOOD_RANGE = 300;
const int EXCELLENT_RANGE = 700;

const uint32_t CALIBRATION_MAGIC = 0x53473246; // SG2F
const uint16_t CALIBRATION_VERSION = 1;
const char* CALIBRATION_KEY = "/kv/smart_glove_2f";

#ifndef A0
#define A0 0
#endif

#ifndef A1
#define A1 1
#endif

const int INDEX_PIN = A0;
const int MIDDLE_PIN = A1;
const int FINGER_COUNT = 2;

struct FingerCal {
  const char* name;
  int pin;
  int readings[WINDOW_SIZE];
  int readIndex;
  long total;
  int flatValue;
  int curlValue;
};

struct CalibrationStore {
  uint32_t magic;
  uint16_t version;
  int flatValues[FINGER_COUNT];
  int curlValues[FINGER_COUNT];
};

FingerCal fingers[FINGER_COUNT] = {
  {"INDEX",  INDEX_PIN, {0}, 0, 0, -1, -1},
  {"MIDDLE", MIDDLE_PIN, {0}, 0, 0, -1, -1}
};

int updateSmooth(FingerCal &finger, int raw);
String readCommand();
void handleCommand(const String &command);
int getRange(const FingerCal &finger);
int getPercent(const FingerCal &finger, int smooth);
String getState(const FingerCal &finger, int percent);
String getQuality(int range);
void saveFlatForFinger(int fingerIndex);
void saveCurlForFinger(int fingerIndex);
void resetFinger(int fingerIndex);
void saveFlatForAll();
void saveCurlForAll();
void resetAll();
int measureMedianSample(int pin);
void sortSamples(int values[], int count);
bool loadCalibration();
bool saveCalibration();
void deleteCalibration();
void printHelp();
void printCalibrationLine(int fingerIndex);
void printAiCsvFrame(int rawValues[], int smoothValues[]);
void printDashboard(int rawValues[], int smoothValues[]);

void setup() {
  Serial.begin(SERIAL_SPEED);
  analogReadResolution(12);
  delay(1000);

  for (int i = 0; i < FINGER_COUNT; i++) {
    fingers[i].total = 0;
    fingers[i].readIndex = 0;
    for (int j = 0; j < WINDOW_SIZE; j++) {
      int value = analogRead(fingers[i].pin);
      fingers[i].readings[j] = value;
      fingers[i].total += value;
    }
  }

  loadCalibration();
  printHelp();
}

void loop() {
  int rawValues[FINGER_COUNT];
  int smoothValues[FINGER_COUNT];

  for (int i = 0; i < FINGER_COUNT; i++) {
    rawValues[i] = analogRead(fingers[i].pin);
    smoothValues[i] = updateSmooth(fingers[i], rawValues[i]);
  }

  String command = readCommand();
  if (command.length() > 0) {
    handleCommand(command);
  }

  printAiCsvFrame(rawValues, smoothValues);
  printDashboard(rawValues, smoothValues);
  delay(READ_DELAY_MS);
}

int updateSmooth(FingerCal &finger, int raw) {
  finger.total -= finger.readings[finger.readIndex];
  finger.readings[finger.readIndex] = raw;
  finger.total += raw;
  finger.readIndex = (finger.readIndex + 1) % WINDOW_SIZE;
  return finger.total / WINDOW_SIZE;
}

String readCommand() {
  if (!Serial.available()) return "";
  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toLowerCase();
  while (Serial.available()) Serial.read();
  return command;
}

void handleCommand(const String &command) {
  if (command == "h" || command == "help") {
    printHelp();
    return;
  }
  if (command == "f" || command == "fa") {
    saveFlatForAll();
    return;
  }
  if (command == "c" || command == "ca") {
    saveCurlForAll();
    return;
  }
  if (command == "r") {
    resetAll();
    return;
  }
  if (command == "f1") {
    saveFlatForFinger(0);
    return;
  }
  if (command == "c1") {
    saveCurlForFinger(0);
    return;
  }
  if (command == "r1") {
    resetFinger(0);
    return;
  }
  if (command == "f2") {
    saveFlatForFinger(1);
    return;
  }
  if (command == "c2") {
    saveCurlForFinger(1);
    return;
  }
  if (command == "r2") {
    resetFinger(1);
    return;
  }

  Serial.print("# Unknown command: ");
  Serial.println(command);
}

int getRange(const FingerCal &finger) {
  if (finger.flatValue == -1 || finger.curlValue == -1) return -1;
  return abs(finger.curlValue - finger.flatValue);
}

int getPercent(const FingerCal &finger, int smooth) {
  if (finger.flatValue == -1 || finger.curlValue == -1) return -1;

  int range = getRange(finger);
  if (range < MIN_USABLE_RANGE) return -1;

  float percent = ((float)(smooth - finger.flatValue) / (float)(finger.curlValue - finger.flatValue)) * 100.0;
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  return (int)percent;
}

String getState(const FingerCal &finger, int percent) {
  if (finger.flatValue == -1 || finger.curlValue == -1) return "UNCALIBRATED";
  if (getRange(finger) < MIN_USABLE_RANGE) return "BAD_RANGE";
  if (percent < 25) return "OPEN";
  if (percent < 65) return "HALF";
  return "BENT";
}

String getQuality(int range) {
  if (range == -1) return "N/A";
  if (range < MIN_USABLE_RANGE) return "BAD";
  if (range < GOOD_RANGE) return "WEAK";
  if (range < VERY_GOOD_RANGE) return "GOOD";
  if (range < EXCELLENT_RANGE) return "VERY_GOOD";
  return "EXCELLENT";
}

void saveFlatForFinger(int fingerIndex) {
  int value = measureMedianSample(fingers[fingerIndex].pin);
  fingers[fingerIndex].flatValue = value;
  saveCalibration();
  Serial.print("# Saved FLAT for ");
  Serial.print(fingers[fingerIndex].name);
  Serial.print(" = ");
  Serial.println(value);
  printCalibrationLine(fingerIndex);
}

void saveCurlForFinger(int fingerIndex) {
  int value = measureMedianSample(fingers[fingerIndex].pin);
  fingers[fingerIndex].curlValue = value;
  saveCalibration();
  Serial.print("# Saved CURL for ");
  Serial.print(fingers[fingerIndex].name);
  Serial.print(" = ");
  Serial.println(value);
  printCalibrationLine(fingerIndex);
}

void resetFinger(int fingerIndex) {
  fingers[fingerIndex].flatValue = -1;
  fingers[fingerIndex].curlValue = -1;
  saveCalibration();
  Serial.print("# Reset ");
  Serial.println(fingers[fingerIndex].name);
  printCalibrationLine(fingerIndex);
}

void saveFlatForAll() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    fingers[i].flatValue = measureMedianSample(fingers[i].pin);
  }
  saveCalibration();
  Serial.println("# Saved FLAT for both fingers");
  printHelp();
}

void saveCurlForAll() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    fingers[i].curlValue = measureMedianSample(fingers[i].pin);
  }
  saveCalibration();
  Serial.println("# Saved CURL for both fingers");
  printHelp();
}

void resetAll() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    fingers[i].flatValue = -1;
    fingers[i].curlValue = -1;
  }
  deleteCalibration();
  Serial.println("# Reset all calibration");
  printHelp();
}

int measureMedianSample(int pin) {
  int samples[CALIBRATION_SAMPLE_COUNT];
  delay(CALIBRATION_SETTLE_MS);

  for (int i = 0; i < CALIBRATION_SAMPLE_COUNT; i++) {
    samples[i] = analogRead(pin);
    delay(2);
  }

  sortSamples(samples, CALIBRATION_SAMPLE_COUNT);
  return samples[CALIBRATION_SAMPLE_COUNT / 2];
}

void sortSamples(int values[], int count) {
  for (int i = 1; i < count; i++) {
    int key = values[i];
    int j = i - 1;
    while (j >= 0 && values[j] > key) {
      values[j + 1] = values[j];
      j--;
    }
    values[j + 1] = key;
  }
}

bool loadCalibration() {
  CalibrationStore stored;
  size_t actualSize = 0;
  int result = kv_get(CALIBRATION_KEY, &stored, sizeof(stored), &actualSize);

  if (result != 0 || actualSize != sizeof(stored)) return false;
  if (stored.magic != CALIBRATION_MAGIC || stored.version != CALIBRATION_VERSION) return false;

  for (int i = 0; i < FINGER_COUNT; i++) {
    fingers[i].flatValue = stored.flatValues[i];
    fingers[i].curlValue = stored.curlValues[i];
  }

  Serial.println("# Calibration restored from flash");
  return true;
}

bool saveCalibration() {
  CalibrationStore stored;
  stored.magic = CALIBRATION_MAGIC;
  stored.version = CALIBRATION_VERSION;

  for (int i = 0; i < FINGER_COUNT; i++) {
    stored.flatValues[i] = fingers[i].flatValue;
    stored.curlValues[i] = fingers[i].curlValue;
  }

  int result = kv_set(CALIBRATION_KEY, &stored, sizeof(stored), 0);
  if (result != 0) {
    Serial.print("# Failed to save calibration: ");
    Serial.println(result);
    return false;
  }

  Serial.println("# Calibration saved to flash");
  return true;
}

void deleteCalibration() {
  kv_remove(CALIBRATION_KEY);
}

void printHelp() {
  Serial.println();
  Serial.println("# Smart Glove 2-finger persistent calibrator");
  Serial.println("# Commands: f/fa, c/ca, f1, c1, f2, c2, r, r1, r2, h");
  Serial.println("# Calibration is saved in board flash and restored on reboot");
  Serial.println("# Stream: indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent");
  for (int i = 0; i < FINGER_COUNT; i++) {
    printCalibrationLine(i);
  }
  Serial.println();
}

void printCalibrationLine(int fingerIndex) {
  FingerCal &finger = fingers[fingerIndex];
  int range = getRange(finger);
  Serial.print("# ");
  Serial.print(fingerIndex + 1);
  Serial.print(":");
  Serial.print(finger.name);
  Serial.print(" flat=");
  Serial.print(finger.flatValue);
  Serial.print(" curl=");
  Serial.print(finger.curlValue);
  Serial.print(" range=");
  if (range == -1) Serial.print("N/A");
  else Serial.print(range);
  Serial.print(" quality=");
  Serial.println(getQuality(range));
}

void printAiCsvFrame(int rawValues[], int smoothValues[]) {
  int indexPercent = getPercent(fingers[0], smoothValues[0]);
  int middlePercent = getPercent(fingers[1], smoothValues[1]);

  Serial.print(rawValues[0]);
  Serial.print(",");
  Serial.print(smoothValues[0]);
  Serial.print(",");
  Serial.print(indexPercent == -1 ? 0 : indexPercent);
  Serial.print(",");
  Serial.print(rawValues[1]);
  Serial.print(",");
  Serial.print(smoothValues[1]);
  Serial.print(",");
  Serial.println(middlePercent == -1 ? 0 : middlePercent);
}

void printDashboard(int rawValues[], int smoothValues[]) {
  Serial.println("------------------------------------------------------------");
  for (int i = 0; i < FINGER_COUNT; i++) {
    int percent = getPercent(fingers[i], smoothValues[i]);
    int range = getRange(fingers[i]);
    Serial.print(fingers[i].name);
    Serial.print(" | RAW=");
    Serial.print(rawValues[i]);
    Serial.print(" | SMOOTH=");
    Serial.print(smoothValues[i]);
    Serial.print(" | FLAT=");
    Serial.print(fingers[i].flatValue);
    Serial.print(" | CURL=");
    Serial.print(fingers[i].curlValue);
    Serial.print(" | RANGE=");
    if (range == -1) Serial.print("N/A");
    else Serial.print(range);
    Serial.print(" | QUALITY=");
    Serial.print(getQuality(range));
    Serial.print(" | PERCENT=");
    if (percent == -1) Serial.print("N/A");
    else {
      Serial.print(percent);
      Serial.print("%");
    }
    Serial.print(" | STATE=");
    Serial.println(getState(fingers[i], percent));
  }
}
