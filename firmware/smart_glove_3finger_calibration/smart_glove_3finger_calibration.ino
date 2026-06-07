// Smart Glove: 3-Finger Persistent Calibration + AI Telemetry
// Board: Arduino Nano 33 BLE Rev2
//
// Pins:
// A0 = Index
// A1 = Middle
// A2 = Ring
//
// Commands:
// f  or fa = save FLAT for all fingers
// c  or ca = save CURL for all fingers
// f1       = save FLAT for index
// c1       = save CURL for index
// f2       = save FLAT for middle
// c2       = save CURL for middle
// f3       = save FLAT for ring
// c3       = save CURL for ring
// r1       = reset index calibration
// r2       = reset middle calibration
// r3       = reset ring calibration
// r  or ra = reset all calibration
// s        = save calibration to flash
// l        = load calibration from flash
// p        = print calibration status
// h        = print calibration help/status
//
// Stream format:
// indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent,ringRaw,ringSmooth,ringPercent

#include "kvstore_global_api.h"

const int SERIAL_SPEED = 115200;
const int READ_DELAY_MS = 60;
const int WINDOW_SIZE = 10;
const int CALIBRATION_SAMPLE_COUNT = 100;
const int CALIBRATION_SETTLE_MS = 300;

const int MIN_USABLE_RANGE = 80;

const uint32_t CALIBRATION_MAGIC = 0x53473346; // SG3F (Smart Glove 3-Finger)
const uint16_t CALIBRATION_VERSION = 3;        // Version 3
const char* CALIBRATION_KEY = "/kv/smart_glove_3f";

#ifndef A0
#define A0 0
#endif

#ifndef A1
#define A1 1
#endif

#ifndef A2
#define A2 2
#endif

const int INDEX_PIN = A0;
const int MIDDLE_PIN = A1;
const int RING_PIN = A2;
const int FINGER_COUNT = 3;

struct FingerConfig {
  const char* name;
  int pin;
};

struct CalibrationStore {
  uint32_t magic;
  uint16_t version;
  uint16_t fingerCount;
  int flatValues[FINGER_COUNT];
  int curlValues[FINGER_COUNT];
  uint32_t checksum; // Data integrity check
};

const FingerConfig fingerConfigs[FINGER_COUNT] = {
  {"INDEX",  INDEX_PIN},
  {"MIDDLE", MIDDLE_PIN},
  {"RING",   RING_PIN}
};

// Raw, smooth, flat, curl, and percent values stored in arrays
int rawValues[FINGER_COUNT];
int smoothValues[FINGER_COUNT];
int flatValues[FINGER_COUNT] = {-1, -1, -1};
int curlValues[FINGER_COUNT] = {-1, -1, -1};
int percentValues[FINGER_COUNT];

// Window filter arrays
int readings[FINGER_COUNT][WINDOW_SIZE];
int readIndex[FINGER_COUNT];
long totals[FINGER_COUNT];

int updateSmooth(int fingerIndex, int raw);
String readCommand();
void handleCommand(const String &command);
int getRange(int fingerIndex);
int getPercent(int fingerIndex, int smooth);
String getState(int fingerIndex, int percent);
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
uint32_t calculateChecksum(CalibrationStore store);

void setup() {
  Serial.begin(SERIAL_SPEED);
  analogReadResolution(12);
  delay(1000);

  // Initialize smoothing window
  for (int i = 0; i < FINGER_COUNT; i++) {
    totals[i] = 0;
    readIndex[i] = 0;
    for (int j = 0; j < WINDOW_SIZE; j++) {
      int value = analogRead(fingerConfigs[i].pin);
      readings[i][j] = value;
      totals[i] += value;
    }
  }

  loadCalibration();
  printHelp();
}

void loop() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    rawValues[i] = analogRead(fingerConfigs[i].pin);
    smoothValues[i] = updateSmooth(i, rawValues[i]);
  }

  String command = readCommand();
  if (command.length() > 0) {
    handleCommand(command);
  }

  printAiCsvFrame(rawValues, smoothValues);
  delay(READ_DELAY_MS);
}

int updateSmooth(int fingerIndex, int raw) {
  totals[fingerIndex] -= readings[fingerIndex][readIndex[fingerIndex]];
  readings[fingerIndex][readIndex[fingerIndex]] = raw;
  totals[fingerIndex] += raw;
  readIndex[fingerIndex] = (readIndex[fingerIndex] + 1) % WINDOW_SIZE;
  return totals[fingerIndex] / WINDOW_SIZE;
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
  if (command == "p" || command == "status") {
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
  if (command == "r" || command == "ra") {
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
  if (command == "f3") {
    saveFlatForFinger(2);
    return;
  }
  if (command == "c3") {
    saveCurlForFinger(2);
    return;
  }
  if (command == "r3") {
    resetFinger(2);
    return;
  }
  if (command == "s") {
    saveCalibration();
    return;
  }
  if (command == "l") {
    loadCalibration();
    return;
  }

  Serial.print("# Unknown command: ");
  Serial.println(command);
}

int getRange(int fingerIndex) {
  if (flatValues[fingerIndex] == -1 || curlValues[fingerIndex] == -1) return -1;
  return abs(curlValues[fingerIndex] - flatValues[fingerIndex]);
}

int getPercent(int fingerIndex, int smooth) {
  if (flatValues[fingerIndex] == -1 || curlValues[fingerIndex] == -1) return -1;

  int range = getRange(fingerIndex);
  if (range < MIN_USABLE_RANGE) return -1;

  float percent;
  if (curlValues[fingerIndex] > flatValues[fingerIndex]) {
    percent = ((float)(smooth - flatValues[fingerIndex]) / (float)range) * 100.0;
  } else {
    percent = ((float)(flatValues[fingerIndex] - smooth) / (float)range) * 100.0;
  }

  return (int)constrain(percent, 0.0, 100.0);
}

String getState(int fingerIndex, int percent) {
  if (flatValues[fingerIndex] == -1 || curlValues[fingerIndex] == -1) return "UNCALIBRATED";
  if (getRange(fingerIndex) < MIN_USABLE_RANGE) return "BAD_RANGE";
  if (percent < 25) return "OPEN";
  if (percent < 65) return "HALF";
  return "BENT";
}

String getQuality(int range) {
  if (range == -1) return "N/A";
  if (range < 80) return "BAD";
  if (range < 200) return "WEAK";
  if (range < 500) return "OK";
  return "GOOD";
}

void saveFlatForFinger(int fingerIndex) {
  int value = measureMedianSample(fingerConfigs[fingerIndex].pin);
  flatValues[fingerIndex] = value;
  saveCalibration(); // Auto-save after calibration command
  Serial.print("# Saved FLAT for ");
  Serial.print(fingerConfigs[fingerIndex].name);
  Serial.print(" = ");
  Serial.println(value);
  printCalibrationLine(fingerIndex);
}

void saveCurlForFinger(int fingerIndex) {
  int value = measureMedianSample(fingerConfigs[fingerIndex].pin);
  curlValues[fingerIndex] = value;
  saveCalibration(); // Auto-save after calibration command
  Serial.print("# Saved CURL for ");
  Serial.print(fingerConfigs[fingerIndex].name);
  Serial.print(" = ");
  Serial.println(value);
  printCalibrationLine(fingerIndex);
}

void resetFinger(int fingerIndex) {
  flatValues[fingerIndex] = -1;
  curlValues[fingerIndex] = -1;
  saveCalibration(); // Auto-save after reset
  Serial.print("# Reset ");
  Serial.println(fingerConfigs[fingerIndex].name);
  printCalibrationLine(fingerIndex);
}

void saveFlatForAll() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    flatValues[i] = measureMedianSample(fingerConfigs[i].pin);
  }
  saveCalibration(); // Auto-save after calibration command
  Serial.println("# Saved FLAT for all fingers");
  printHelp();
}

void saveCurlForAll() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    curlValues[i] = measureMedianSample(fingerConfigs[i].pin);
  }
  saveCalibration(); // Auto-save after calibration command
  Serial.println("# Saved CURL for all fingers");
  printHelp();
}

void resetAll() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    flatValues[i] = -1;
    curlValues[i] = -1;
  }
  deleteCalibration(); // Delete key from flash
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

uint32_t calculateChecksum(CalibrationStore store) {
  store.checksum = 0; // Zero out checksum field inside local copy
  uint32_t sum = 0;
  const uint8_t* ptr = (const uint8_t*)&store;
  for (size_t i = 0; i < sizeof(CalibrationStore); i++) {
    sum += ptr[i];
  }
  return sum;
}

bool loadCalibration() {
  CalibrationStore stored = {}; // Clean zero-initialization
  size_t actualSize = 0;
  int result = kv_get(CALIBRATION_KEY, &stored, sizeof(stored), &actualSize);

  // 1. KV read success check
  if (result != 0 || actualSize != sizeof(stored)) {
    Serial.println("# No valid calibration found. Using defaults");
    return false;
  }

  // 2. magic check, 3. version check, 4. fingerCount check
  if (stored.magic != CALIBRATION_MAGIC || 
      stored.version != CALIBRATION_VERSION || 
      stored.fingerCount != FINGER_COUNT) {
    Serial.println("# No valid calibration found. Using defaults");
    return false;
  }

  // 5. checksum check
  uint32_t savedChecksum = stored.checksum;
  uint32_t expectedChecksum = calculateChecksum(stored); // internally zeros stored.checksum
  if (savedChecksum != expectedChecksum) {
    Serial.println("# No valid calibration found. Using defaults");
    return false;
  }

  // 6. flat/curl sanity check
  for (int i = 0; i < FINGER_COUNT; i++) {
    // ADC boundaries check (0-4095)
    if (stored.flatValues[i] < 0 || stored.flatValues[i] > 4095 ||
        stored.curlValues[i] < 0 || stored.curlValues[i] > 4095) {
      Serial.println("# No valid calibration found. Using defaults");
      return false;
    }
    // Impossible range check (must not be 0 or extremely close to 0 to prevent div by zero)
    if (abs(stored.flatValues[i] - stored.curlValues[i]) < 20) {
      Serial.println("# No valid calibration found. Using defaults");
      return false;
    }
  }

  for (int i = 0; i < FINGER_COUNT; i++) {
    flatValues[i] = stored.flatValues[i];
    curlValues[i] = stored.curlValues[i];
  }

  Serial.println("# Calibration restored from flash");
  return true;
}

bool saveCalibration() {
  CalibrationStore stored = {}; // Clean zero-initialization to avoid padding byte corruption
  stored.magic = CALIBRATION_MAGIC;
  stored.version = CALIBRATION_VERSION;
  stored.fingerCount = FINGER_COUNT;

  for (int i = 0; i < FINGER_COUNT; i++) {
    stored.flatValues[i] = flatValues[i];
    stored.curlValues[i] = curlValues[i];
  }

  stored.checksum = calculateChecksum(stored);

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
  Serial.println("# Smart Glove 3-finger persistent calibrator");
  Serial.println("# Commands:");
  Serial.println("#   h/help/status = print status");
  Serial.println("#   f1/f2/f3      = calibrate flat for Index/Middle/Ring");
  Serial.println("#   c1/c2/c3      = calibrate curl for Index/Middle/Ring");
  Serial.println("#   f/fa          = calibrate all flat");
  Serial.println("#   c/ca          = calibrate all curl");
  Serial.println("#   r1/r2/r3      = reset calibration for Index/Middle/Ring");
  Serial.println("#   r/ra          = reset all");
  Serial.println("#   s             = save calibration to flash");
  Serial.println("#   l             = load calibration from flash");
  Serial.println("# Calibration is saved in board flash and restored on reboot");
  for (int i = 0; i < FINGER_COUNT; i++) {
    printCalibrationLine(i);
  }
  Serial.println();
}

void printCalibrationLine(int fingerIndex) {
  int range = getRange(fingerIndex);
  Serial.print("# ");
  Serial.print(fingerIndex + 1);
  Serial.print(":");
  Serial.print(fingerConfigs[fingerIndex].name);
  Serial.print(" flat=");
  Serial.print(flatValues[fingerIndex]);
  Serial.print(" curl=");
  Serial.print(curlValues[fingerIndex]);
  Serial.print(" range=");
  if (range == -1) Serial.print("N/A");
  else Serial.print(range);
  Serial.print(" quality=");
  Serial.println(getQuality(range));
}

void printAiCsvFrame(int rawValues[], int smoothValues[]) {
  for (int i = 0; i < FINGER_COUNT; i++) {
    int percent = getPercent(i, smoothValues[i]);
    
    Serial.print(rawValues[i]);
    Serial.print(",");
    Serial.print(smoothValues[i]);
    Serial.print(",");
    Serial.print(percent == -1 ? 0 : percent);
    
    if (i < FINGER_COUNT - 1) {
      Serial.print(",");
    }
  }
  Serial.println();
}
