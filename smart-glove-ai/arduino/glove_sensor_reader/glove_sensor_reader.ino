// Smart Glove: 5-Finger Persistent Calibration + AI Telemetry
// Board: Arduino Nano 33 BLE Rev2
//
// Pins:
// A0 = Index
// A1 = Middle
// A2 = Ring
// A3 = Pinky
// A4 = Thumb
//
// Commands:
// f  or fa = save FLAT for all fingers
// c  or ca = save CURL for all fingers
// f1       = save FLAT for Index
// c1       = save CURL for Index
// f2       = save FLAT for Middle
// c2       = save CURL for Middle
// f3       = save FLAT for Ring
// c3       = save CURL for Ring
// f4       = save FLAT for Pinky
// c4       = save CURL for Pinky
// f5       = save FLAT for Thumb
// c5       = save CURL for Thumb
// r1..r5   = reset calibration for one finger
// r  or ra = reset all calibration
// s        = save calibration to flash
// l        = load calibration from flash
// p        = print calibration status
// h        = print help/status
//
// Stream format (5 values):
// index,middle,ring,pinky,thumb
//
// IMPORTANT FIX:
// Calibration loading allows partial calibration.
// The old version rejected the whole flash record if any finger was still N/A
// or had a weak range, which made values appear to disappear after unplugging.

#include "kvstore_global_api.h"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const int SERIAL_SPEED            = 115200;
const int READ_DELAY_MS           = 60;
const int WINDOW_SIZE             = 10;
const int CALIBRATION_SAMPLE_COUNT = 100;
const int CALIBRATION_SETTLE_MS   = 300;
const int MIN_USABLE_RANGE        = 20;   // Absolute floor — prevents div/zero
                                           // Weak fingers (Pinky/Thumb) allowed in demo mode

// ---------------------------------------------------------------------------
// Flash storage
// ---------------------------------------------------------------------------
const uint32_t CALIBRATION_MAGIC   = 0x53473546; // SG5F — Smart Glove 5-Finger
const uint16_t CALIBRATION_VERSION = 5;
const char*    CALIBRATION_KEY     = "/kv/smart_glove_5f";

// ---------------------------------------------------------------------------
// Pin mapping
// ---------------------------------------------------------------------------
#ifndef A0
#define A0 0
#endif
#ifndef A1
#define A1 1
#endif
#ifndef A2
#define A2 2
#endif
#ifndef A3
#define A3 3
#endif
#ifndef A4
#define A4 4
#endif

const int FINGER_COUNT = 5;

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------
struct FingerConfig {
  const char* name;
  int         pin;
};

struct CalibrationStore {
  uint32_t magic;
  uint16_t version;
  uint16_t fingerCount;
  int      flatValues[FINGER_COUNT];
  int      curlValues[FINGER_COUNT];
  uint32_t checksum;
};

// ---------------------------------------------------------------------------
// Finger definitions — order must match CSV output order
// ---------------------------------------------------------------------------
const FingerConfig fingerConfigs[FINGER_COUNT] = {
  {"INDEX",  A0},
  {"MIDDLE", A1},
  {"RING",   A2},
  {"PINKY",  A3},
  {"THUMB",  A4}
};

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------
int rawValues[FINGER_COUNT];
int smoothValues[FINGER_COUNT];
int flatValues[FINGER_COUNT] = {-1, -1, -1, -1, -1};
int curlValues[FINGER_COUNT] = {-1, -1, -1, -1, -1};
int percentValues[FINGER_COUNT];

// Moving-average window per finger
int  readings[FINGER_COUNT][WINDOW_SIZE];
int  readIndex[FINGER_COUNT];
long totals[FINGER_COUNT];

// ---------------------------------------------------------------------------
// Forward declarations
// ---------------------------------------------------------------------------
int     updateSmooth(int fingerIndex, int raw);
String  readCommand();
void    handleCommand(const String& command);
int     getRange(int fingerIndex);
int     getPercent(int fingerIndex, int smooth);
String  getState(int fingerIndex, int percent);
String  getQuality(int fingerIndex, int range);
void    saveFlatForFinger(int fingerIndex);
void    saveCurlForFinger(int fingerIndex);
void    resetFinger(int fingerIndex);
void    saveFlatForAll();
void    saveCurlForAll();
void    resetAll();
int     measureMedianSample(int pin);
void    sortSamples(int values[], int count);
bool    loadCalibration();
bool    saveCalibration();
void    deleteCalibration();
void    printHelp();
void    printCalibrationLine(int fingerIndex);
void    printAiCsvFrame();
uint32_t calculateChecksum(CalibrationStore store);

// ---------------------------------------------------------------------------
// setup()
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(SERIAL_SPEED);
  analogReadResolution(12);
  delay(1000);

  // Prime the moving-average windows with real readings
  for (int i = 0; i < FINGER_COUNT; i++) {
    totals[i]    = 0;
    readIndex[i] = 0;
    for (int j = 0; j < WINDOW_SIZE; j++) {
      int value        = analogRead(fingerConfigs[i].pin);
      readings[i][j]   = value;
      totals[i]       += value;
    }
  }

  loadCalibration();
  printHelp();
}

// ---------------------------------------------------------------------------
// loop()
// ---------------------------------------------------------------------------
void loop() {
  // Read all sensors
  for (int i = 0; i < FINGER_COUNT; i++) {
    rawValues[i]    = analogRead(fingerConfigs[i].pin);
    smoothValues[i] = updateSmooth(i, rawValues[i]);
  }

  // Check for Serial command
  String command = readCommand();
  if (command.length() > 0) {
    handleCommand(command);
  }

  // Stream CSV frame
  printAiCsvFrame();
  delay(READ_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Moving-average smoothing
// ---------------------------------------------------------------------------
int updateSmooth(int fingerIndex, int raw) {
  totals[fingerIndex] -= readings[fingerIndex][readIndex[fingerIndex]];
  readings[fingerIndex][readIndex[fingerIndex]] = raw;
  totals[fingerIndex] += raw;
  readIndex[fingerIndex] = (readIndex[fingerIndex] + 1) % WINDOW_SIZE;
  return (int)(totals[fingerIndex] / WINDOW_SIZE);
}

// ---------------------------------------------------------------------------
// Serial command reader
// ---------------------------------------------------------------------------
String readCommand() {
  if (!Serial.available()) return "";
  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toLowerCase();
  while (Serial.available()) Serial.read();
  return command;
}

// ---------------------------------------------------------------------------
// Command dispatcher
// ---------------------------------------------------------------------------
void handleCommand(const String& command) {
  // Help / status
  if (command == "h" || command == "help" || command == "p" || command == "status") {
    printHelp();
    return;
  }

  // Safe no-op used by some Python live scripts after opening Serial.
  if (command == "snap") {
    printHelp();
    return;
  }

  // All-finger flat / curl / reset
  if (command == "f" || command == "fa") { saveFlatForAll(); return; }
  if (command == "c" || command == "ca") { saveCurlForAll(); return; }
  if (command == "r" || command == "ra") { resetAll();       return; }

  // Save / load
  if (command == "s") { saveCalibration(); return; }
  if (command == "l") { loadCalibration(); return; }

  // Per-finger commands: f1..f5, c1..c5, r1..r5
  if (command.length() == 2) {
    char action = command[0];
    int  idx    = command[1] - '1';   // '1'→0, '2'→1, ..., '5'→4

    if (idx >= 0 && idx < FINGER_COUNT) {
      if      (action == 'f') { saveFlatForFinger(idx); return; }
      else if (action == 'c') { saveCurlForFinger(idx); return; }
      else if (action == 'r') { resetFinger(idx);       return; }
    }
  }

  Serial.print("# Unknown command: ");
  Serial.println(command);
  Serial.println("# Send h for help.");
}

// ---------------------------------------------------------------------------
// Calibration helpers
// ---------------------------------------------------------------------------
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
    percent = ((float)(smooth - flatValues[fingerIndex]) / (float)range) * 100.0f;
  } else {
    percent = ((float)(flatValues[fingerIndex] - smooth) / (float)range) * 100.0f;
  }

  return (int)constrain(percent, 0.0f, 100.0f);
}

String getState(int fingerIndex, int percent) {
  if (flatValues[fingerIndex] == -1 || curlValues[fingerIndex] == -1) return "UNCALIBRATED";
  if (getRange(fingerIndex) < MIN_USABLE_RANGE)                        return "BAD_RANGE";
  if (percent < 25) return "OPEN";
  if (percent < 65) return "HALF";
  return "BENT";
}

// Per-finger quality — Pinky and Thumb are allowed weaker ranges in demo mode
String getQuality(int fingerIndex, int range) {
  if (range == -1) return "N/A";
  // Thumb (4) and Pinky (3) have small physical ranges — demo thresholds apply
  bool weakFinger = (fingerIndex == 3 || fingerIndex == 4);
  if (weakFinger) {
    if (range < 10)  return "BAD";
    if (range < 30)  return "WEAK_DEMO";
    if (range < 100) return "OK_DEMO";
    return "GOOD";
  }
  // Strong fingers (Index, Middle, Ring)
  if (range < 80)  return "BAD";
  if (range < 200) return "WEAK";
  if (range < 500) return "OK";
  return "GOOD";
}

// ---------------------------------------------------------------------------
// Calibration actions
// ---------------------------------------------------------------------------
void saveFlatForFinger(int fingerIndex) {
  int value = measureMedianSample(fingerConfigs[fingerIndex].pin);
  flatValues[fingerIndex] = value;
  saveCalibration();
  Serial.print("# Saved FLAT for ");
  Serial.print(fingerConfigs[fingerIndex].name);
  Serial.print(" = ");
  Serial.println(value);
  printCalibrationLine(fingerIndex);
}

void saveCurlForFinger(int fingerIndex) {
  int value = measureMedianSample(fingerConfigs[fingerIndex].pin);
  curlValues[fingerIndex] = value;
  saveCalibration();
  Serial.print("# Saved CURL for ");
  Serial.print(fingerConfigs[fingerIndex].name);
  Serial.print(" = ");
  Serial.println(value);
  printCalibrationLine(fingerIndex);
}

void resetFinger(int fingerIndex) {
  flatValues[fingerIndex] = -1;
  curlValues[fingerIndex] = -1;
  saveCalibration();
  Serial.print("# Reset ");
  Serial.println(fingerConfigs[fingerIndex].name);
  printCalibrationLine(fingerIndex);
}

void saveFlatForAll() {
  Serial.println("# Sampling FLAT for all 5 fingers...");
  for (int i = 0; i < FINGER_COUNT; i++) {
    flatValues[i] = measureMedianSample(fingerConfigs[i].pin);
  }
  saveCalibration();
  Serial.println("# Saved FLAT for all fingers.");
  printHelp();
}

void saveCurlForAll() {
  Serial.println("# Sampling CURL for all 5 fingers...");
  for (int i = 0; i < FINGER_COUNT; i++) {
    curlValues[i] = measureMedianSample(fingerConfigs[i].pin);
  }
  saveCalibration();
  Serial.println("# Saved CURL for all 5 fingers.");
  printHelp();
}

void resetAll() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    flatValues[i] = -1;
    curlValues[i] = -1;
  }
  deleteCalibration();
  Serial.println("# Reset all calibration.");
  printHelp();
}

// ---------------------------------------------------------------------------
// Median sampling (100 samples, sorted, middle value)
// ---------------------------------------------------------------------------
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
    int j   = i - 1;
    while (j >= 0 && values[j] > key) {
      values[j + 1] = values[j];
      j--;
    }
    values[j + 1] = key;
  }
}

// ---------------------------------------------------------------------------
// Checksum (pass struct by value so we can zero the checksum field safely)
// ---------------------------------------------------------------------------
uint32_t calculateChecksum(CalibrationStore store) {
  store.checksum = 0;
  uint32_t sum = 0;
  const uint8_t* ptr = (const uint8_t*)&store;
  for (size_t i = 0; i < sizeof(CalibrationStore); i++) {
    sum += ptr[i];
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Flash load — robust partial-restore validation
// ---------------------------------------------------------------------------
bool loadCalibration() {
  CalibrationStore stored = {};
  size_t actualSize = 0;

  int result = kv_get(CALIBRATION_KEY, &stored, sizeof(stored), &actualSize);
  if (result != 0 || actualSize != sizeof(stored)) {
    Serial.println("# No calibration found in flash. Using defaults.");
    return false;
  }

  if (stored.magic != CALIBRATION_MAGIC) {
    Serial.println("# Calibration record has wrong magic. Using defaults.");
    return false;
  }

  if (stored.version != CALIBRATION_VERSION) {
    Serial.println("# Calibration record has old version. Using defaults.");
    return false;
  }

  if (stored.fingerCount != FINGER_COUNT) {
    Serial.println("# Calibration record has wrong finger count. Using defaults.");
    return false;
  }

  uint32_t savedChecksum    = stored.checksum;
  uint32_t expectedChecksum = calculateChecksum(stored);
  if (savedChecksum != expectedChecksum) {
    Serial.println("# Calibration checksum failed. Using defaults.");
    return false;
  }

  bool restoredAny = false;

  // Allow partial calibration:
  // -1 means "not calibrated yet" and is valid.
  // 0..4095 means a valid ADC reading.
  // One bad finger must NOT erase the other four fingers.
  for (int i = 0; i < FINGER_COUNT; i++) {
    int flat = stored.flatValues[i];
    int curl = stored.curlValues[i];

    bool flatOk = (flat == -1 || (flat >= 0 && flat <= 4095));
    bool curlOk = (curl == -1 || (curl >= 0 && curl <= 4095));

    if (!flatOk || !curlOk) {
      flatValues[i] = -1;
      curlValues[i] = -1;
      Serial.print("# Ignored invalid calibration for ");
      Serial.println(fingerConfigs[i].name);
      continue;
    }

    flatValues[i] = flat;
    curlValues[i] = curl;

    if (flat != -1 || curl != -1) {
      restoredAny = true;
    }
  }

  if (restoredAny) {
    Serial.println("# Calibration restored from flash.");
    return true;
  }

  Serial.println("# Calibration file exists, but all fingers are N/A.");
  return false;
}

// ---------------------------------------------------------------------------
// Flash save
// ---------------------------------------------------------------------------
bool saveCalibration() {
  CalibrationStore stored = {};
  stored.magic       = CALIBRATION_MAGIC;
  stored.version     = CALIBRATION_VERSION;
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

  Serial.println("# Calibration saved to flash.");
  return true;
}

void deleteCalibration() {
  kv_remove(CALIBRATION_KEY);
}

// ---------------------------------------------------------------------------
// Serial output
// ---------------------------------------------------------------------------
void printHelp() {
  Serial.println();
  Serial.println("# Smart Glove 5-Finger Persistent Calibration Firmware");
  Serial.println("# Board : Arduino Nano 33 BLE Rev2");
  Serial.println("# Pins  : A0=Index A1=Middle A2=Ring A3=Pinky A4=Thumb");
  Serial.println("#");
  Serial.println("# Commands:");
  Serial.println("#   h / help / status  = print this status");
  Serial.println("#   f1..f5             = save FLAT  for one finger (1=Index .. 5=Thumb)");
  Serial.println("#   c1..c5             = save CURL  for one finger");
  Serial.println("#   r1..r5             = reset calibration for one finger");
  Serial.println("#   f / fa             = save FLAT  for all 5 fingers");
  Serial.println("#   c / ca             = save CURL  for all 5 fingers");
  Serial.println("#   r / ra             = reset all calibration");
  Serial.println("#   s                  = save to flash (auto-saved after every command)");
  Serial.println("#   l                  = reload from flash");
  Serial.println("#");
  Serial.println("# Calibration status:");
  for (int i = 0; i < FINGER_COUNT; i++) {
    printCalibrationLine(i);
  }
  Serial.println("#");
  Serial.println("# CSV stream: index,middle,ring,pinky,thumb");
  Serial.println();
}

void printCalibrationLine(int fingerIndex) {
  int range = getRange(fingerIndex);
  Serial.print("# ");
  Serial.print(fingerIndex + 1);
  Serial.print(":");
  Serial.print(fingerConfigs[fingerIndex].name);
  Serial.print(" pin=A");
  Serial.print(fingerIndex);
  Serial.print(" flat=");
  if (flatValues[fingerIndex] == -1) Serial.print("N/A"); else Serial.print(flatValues[fingerIndex]);
  Serial.print(" curl=");
  if (curlValues[fingerIndex] == -1) Serial.print("N/A"); else Serial.print(curlValues[fingerIndex]);
  Serial.print(" range=");
  if (range == -1) Serial.print("N/A"); else Serial.print(range);
  Serial.print(" quality=");
  Serial.println(getQuality(fingerIndex, range));
}

// CSV: 5 values — percent only, matching Python:
// index,middle,ring,pinky,thumb
// Comment lines start with # so Python parsers can skip them safely.
void printAiCsvFrame() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    int percent = getPercent(i, smoothValues[i]);
    Serial.print(percent == -1 ? 0 : percent);

    if (i < FINGER_COUNT - 1) Serial.print(",");
  }
  Serial.println();
}
