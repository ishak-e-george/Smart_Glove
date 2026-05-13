// Smart Glove AI - 5 Finger Calibrator + 2 Finger ML Stream
// Board: Arduino Nano 33 BLE Rev2
//
// Wiring per finger:
// 3.3V -> Flex Sensor -> Analog Pin -> 22k resistor -> GND
// Optional: 0.1uF capacitor from analog pin to GND
//
// Pins:
// A0 = Index
// A1 = Middle
// A2 = Ring
// A3 = Pinky
// A4 = Thumb
//
// Serial commands:
// n1..n5 = set how many fingers are physically connected right now
// f1..f5 = save current smoothed reading as FLAT for one finger
// c1..c5 = save current smoothed reading as CURL for one finger
// r1..r5 = reset calibration for one finger
// fa = save FLAT for all fingers
// ca = save CURL for all fingers
// r  = reset all calibration
// h  = print help and current calibration
//
// Current ML output format:
// indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent

#include "kvstore_global_api.h"

const unsigned long SERIAL_BAUD = 115200;
const unsigned long SAMPLE_DELAY_MS = 100;
const unsigned long CALIBRATION_SETTLE_MS = 500;

const int WINDOW_SIZE = 10;
const int CALIBRATION_SAMPLE_COUNT = 100;

const int MIN_RANGE_FOR_PERCENT = 100;
const int GOOD_RANGE = 150;
const int FINGER_COUNT = 5;

const uint32_t CALIBRATION_MAGIC = 0x53474149;
const uint16_t CALIBRATION_VERSION = 2;
const char* CALIBRATION_KEY = "/kv/smart_glove_cal";

struct FingerSensor {
  const char* name;
  int pin;
  int samples[WINDOW_SIZE];
  int sampleIndex;
  long sampleTotal;
  int flatValue;
  int curlValue;
};

FingerSensor fingers[FINGER_COUNT] = {
  {"INDEX",  A0, {0}, 0, 0, -1, -1},
  {"MIDDLE", A1, {0}, 0, 0, -1, -1},
  {"RING",   A2, {0}, 0, 0, -1, -1},
  {"PINKY",  A3, {0}, 0, 0, -1, -1},
  {"THUMB",  A4, {0}, 0, 0, -1, -1}
};

struct CalibrationStore {
  uint32_t magic;
  uint16_t version;
  int activeFingerCount;
  int flatValues[FINGER_COUNT];
  int curlValues[FINGER_COUNT];
};

int activeFingerCount = 2;

int updateSmooth(FingerSensor &finger, int rawValue);
int computePercent(const FingerSensor &finger, int smoothValue);
int computeRange(const FingerSensor &finger);
const char* getRangeQuality(const FingerSensor &finger);

void handleSerialCommands(int smoothValues[]);
void saveFlatCalibration(FingerSensor &finger, int smoothValue);
void saveCurlCalibration(FingerSensor &finger, int smoothValue);
void resetCalibration(FingerSensor &finger);

void printHelp();
void printCalibrationLine(const FingerSensor &finger, int fingerNumber);

bool loadCalibration();
bool saveCalibration();
void deleteCalibration();

String readCommand();
int parseFingerNumber(const String &text);
bool isFingerActive(int fingerIndex);
void setActiveFingerCount(int count);

void saveFlatForFinger(int fingerIndex, int smoothValues[]);
void saveCurlForFinger(int fingerIndex, int smoothValues[]);
void resetFingerCalibration(int fingerIndex);

void saveFlatForAll(int smoothValues[]);
void saveCurlForAll(int smoothValues[]);
void resetAllCalibration();

int measureMedianSample(int pin);
void sortSamples(int values[], int count);

void setup() {
  Serial.begin(SERIAL_BAUD);
  analogReadResolution(12);
  delay(1000);

  for (int i = 0; i < FINGER_COUNT; i++) {
    fingers[i].sampleTotal = 0;
    fingers[i].sampleIndex = 0;

    for (int j = 0; j < WINDOW_SIZE; j++) {
      int reading = analogRead(fingers[i].pin);
      fingers[i].samples[j] = reading;
      fingers[i].sampleTotal += reading;
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

  handleSerialCommands(smoothValues);

  int indexPercent = computePercent(fingers[0], smoothValues[0]);
  int middlePercent = computePercent(fingers[1], smoothValues[1]);

  Serial.print(rawValues[0]);
  Serial.print(",");
  Serial.print(smoothValues[0]);
  Serial.print(",");
  Serial.print(indexPercent);
  Serial.print(",");
  Serial.print(rawValues[1]);
  Serial.print(",");
  Serial.print(smoothValues[1]);
  Serial.print(",");
  Serial.println(middlePercent);

  delay(SAMPLE_DELAY_MS);
}

int updateSmooth(FingerSensor &finger, int rawValue) {
  finger.sampleTotal -= finger.samples[finger.sampleIndex];
  finger.samples[finger.sampleIndex] = rawValue;
  finger.sampleTotal += rawValue;

  finger.sampleIndex++;
  if (finger.sampleIndex >= WINDOW_SIZE) {
    finger.sampleIndex = 0;
  }

  return finger.sampleTotal / WINDOW_SIZE;
}

int computeRange(const FingerSensor &finger) {
  if (finger.flatValue < 0 || finger.curlValue < 0) {
    return 0;
  }

  return abs(finger.curlValue - finger.flatValue);
}

int computePercent(const FingerSensor &finger, int smoothValue) {
  if (finger.flatValue < 0 || finger.curlValue < 0) {
    return -1;
  }

  int range = computeRange(finger);

  if (range < MIN_RANGE_FOR_PERCENT || finger.flatValue == finger.curlValue) {
    return -1;
  }

  float percent = ((float)(smoothValue - finger.flatValue) / (float)(finger.curlValue - finger.flatValue)) * 100.0;

  if (percent < 0.0) {
    percent = 0.0;
  }

  if (percent > 100.0) {
    percent = 100.0;
  }

  return (int)(percent + 0.5);
}

const char* getRangeQuality(const FingerSensor &finger) {
  if (finger.flatValue < 0 || finger.curlValue < 0) {
    return "N/A";
  }

  int range = computeRange(finger);

  if (range < MIN_RANGE_FOR_PERCENT) {
    return "BAD";
  }

  if (range < GOOD_RANGE) {
    return "USABLE";
  }

  return "GOOD";
}

void handleSerialCommands(int smoothValues[]) {
  String command = readCommand();

  if (command.length() == 0) {
    return;
  }

  command.trim();
  command.toLowerCase();

  if (command == "h" || command == "?") {
    printHelp();
    return;
  }

  if (command.startsWith("n") && command.length() >= 2) {
    int requestedCount = command.substring(1).toInt();

    if (requestedCount < 1 || requestedCount > FINGER_COUNT) {
      Serial.println("# Invalid active finger count. Use n1..n5");
      return;
    }

    setActiveFingerCount(requestedCount);
    return;
  }

  if (command.startsWith("f") && command.length() >= 2 && command != "fa") {
    int fingerIndex = parseFingerNumber(command.substring(1));

    if (fingerIndex < 0 || fingerIndex >= FINGER_COUNT) {
      Serial.println("# Invalid finger for FLAT. Use f1..f5");
      return;
    }

    saveFlatForFinger(fingerIndex, smoothValues);
    return;
  }

  if (command.startsWith("c") && command.length() >= 2 && command != "ca") {
    int fingerIndex = parseFingerNumber(command.substring(1));

    if (fingerIndex < 0 || fingerIndex >= FINGER_COUNT) {
      Serial.println("# Invalid finger for CURL. Use c1..c5");
      return;
    }

    saveCurlForFinger(fingerIndex, smoothValues);
    return;
  }

  if (command.startsWith("r") && command.length() >= 2) {
    int fingerIndex = parseFingerNumber(command.substring(1));

    if (fingerIndex < 0 || fingerIndex >= FINGER_COUNT) {
      Serial.println("# Invalid finger for RESET. Use r1..r5");
      return;
    }

    resetFingerCalibration(fingerIndex);
    return;
  }

  if (command == "fa" || command == "f") {
    saveFlatForAll(smoothValues);
    return;
  }

  if (command == "ca" || command == "c") {
    saveCurlForAll(smoothValues);
    return;
  }

  if (command == "r") {
    resetAllCalibration();
    return;
  }

  Serial.print("# Unknown command: ");
  Serial.println(command);
}

void saveFlatCalibration(FingerSensor &finger, int smoothValue) {
  finger.flatValue = smoothValue;
}

void saveCurlCalibration(FingerSensor &finger, int smoothValue) {
  finger.curlValue = smoothValue;
}

void resetCalibration(FingerSensor &finger) {
  finger.flatValue = -1;
  finger.curlValue = -1;
}

void printHelp() {
  Serial.println("# Smart Glove AI 5-finger calibrator");
  Serial.println("# Commands:");
  Serial.println("#   n1..n5 = set how many fingers are connected");
  Serial.println("#   f1..f5 = save flat for one finger");
  Serial.println("#   c1..c5 = save curl for one finger");
  Serial.println("#   r1..r5 = reset one finger");
  Serial.println("#   fa = save flat for all fingers");
  Serial.println("#   ca = save curl for all fingers");
  Serial.println("#   r  = reset all fingers");
  Serial.println("#   h  = help");
  Serial.println("# Calibration is saved in board flash and restored on reboot");

  Serial.print("# Active finger count = ");
  Serial.println(activeFingerCount);

  if (activeFingerCount < 2) {
    Serial.println("# Warning: the Python ML demo expects at least INDEX and MIDDLE connected");
  }

  for (int i = 0; i < FINGER_COUNT; i++) {
    printCalibrationLine(fingers[i], i + 1);
  }

  Serial.println("# Current ML stream keeps 2-finger CSV compatibility");
  Serial.println("# Streaming CSV: indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent");
}

void printCalibrationLine(const FingerSensor &finger, int fingerNumber) {
  Serial.print("# ");
  Serial.print(fingerNumber);
  Serial.print(":");
  Serial.print(finger.name);
  Serial.print(" active=");
  Serial.print(isFingerActive(fingerNumber - 1) ? "Y" : "N");
  Serial.print(" flat=");
  Serial.print(finger.flatValue);
  Serial.print(" curl=");
  Serial.print(finger.curlValue);
  Serial.print(" range=");
  Serial.print(computeRange(finger));
  Serial.print(" quality=");
  Serial.println(getRangeQuality(finger));
}

bool loadCalibration() {
  CalibrationStore stored;
  size_t actualSize = 0;

  int result = kv_get(CALIBRATION_KEY, &stored, sizeof(stored), &actualSize);

  if (result != 0 || actualSize != sizeof(stored)) {
    return false;
  }

  if (stored.magic != CALIBRATION_MAGIC || stored.version != CALIBRATION_VERSION) {
    return false;
  }

  if (stored.activeFingerCount >= 1 && stored.activeFingerCount <= FINGER_COUNT) {
    activeFingerCount = stored.activeFingerCount;
  }

  for (int i = 0; i < FINGER_COUNT; i++) {
    fingers[i].flatValue = stored.flatValues[i];
    fingers[i].curlValue = stored.curlValues[i];
  }

  return true;
}

bool saveCalibration() {
  CalibrationStore stored;

  stored.magic = CALIBRATION_MAGIC;
  stored.version = CALIBRATION_VERSION;
  stored.activeFingerCount = activeFingerCount;

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

String readCommand() {
  if (!Serial.available()) {
    return "";
  }

  String command = Serial.readStringUntil('\n');
  command.trim();

  return command;
}

int parseFingerNumber(const String &text) {
  if (text.length() == 0) {
    return -1;
  }

  int fingerNumber = text.toInt();

  if (fingerNumber < 1 || fingerNumber > FINGER_COUNT) {
    return -1;
  }

  return fingerNumber - 1;
}

bool isFingerActive(int fingerIndex) {
  return fingerIndex >= 0 && fingerIndex < activeFingerCount;
}

void setActiveFingerCount(int count) {
  if (count < 1 || count > FINGER_COUNT) {
    Serial.println("# Invalid active finger count");
    return;
  }

  activeFingerCount = count;
  saveCalibration();

  Serial.print("# Active finger count set to ");
  Serial.println(activeFingerCount);

  printHelp();
}

void saveFlatForFinger(int fingerIndex, int smoothValues[]) {
  if (!isFingerActive(fingerIndex)) {
    Serial.print("# ");
    Serial.print(fingers[fingerIndex].name);
    Serial.println(" is not active. Use n1..n5 first.");
    return;
  }

  int medianValue = measureMedianSample(fingers[fingerIndex].pin);
  saveFlatCalibration(fingers[fingerIndex], medianValue);
  saveCalibration();

  Serial.print("# Saved FLAT for ");
  Serial.println(fingers[fingerIndex].name);

  Serial.print("# Median FLAT value = ");
  Serial.println(medianValue);

  printCalibrationLine(fingers[fingerIndex], fingerIndex + 1);
}

void saveCurlForFinger(int fingerIndex, int smoothValues[]) {
  if (!isFingerActive(fingerIndex)) {
    Serial.print("# ");
    Serial.print(fingers[fingerIndex].name);
    Serial.println(" is not active. Use n1..n5 first.");
    return;
  }

  int medianValue = measureMedianSample(fingers[fingerIndex].pin);
  saveCurlCalibration(fingers[fingerIndex], medianValue);
  saveCalibration();

  Serial.print("# Saved CURL for ");
  Serial.println(fingers[fingerIndex].name);

  Serial.print("# Median CURL value = ");
  Serial.println(medianValue);

  printCalibrationLine(fingers[fingerIndex], fingerIndex + 1);

  if (computeRange(fingers[fingerIndex]) < MIN_RANGE_FOR_PERCENT) {
    Serial.print("# Warning: ");
    Serial.print(fingers[fingerIndex].name);
    Serial.println(" range is BAD. Recalibrate with a stronger bend.");
  }
}

void resetFingerCalibration(int fingerIndex) {
  if (!isFingerActive(fingerIndex)) {
    Serial.print("# ");
    Serial.print(fingers[fingerIndex].name);
    Serial.println(" is not active. Use n1..n5 first.");
    return;
  }

  resetCalibration(fingers[fingerIndex]);
  saveCalibration();

  Serial.print("# Reset calibration for ");
  Serial.println(fingers[fingerIndex].name);

  printCalibrationLine(fingers[fingerIndex], fingerIndex + 1);
}

void saveFlatForAll(int smoothValues[]) {
  for (int i = 0; i < activeFingerCount; i++) {
    int medianValue = measureMedianSample(fingers[i].pin);
    saveFlatCalibration(fingers[i], medianValue);
  }

  saveCalibration();

  Serial.println("# Saved FLAT for all active fingers");

  for (int i = 0; i < FINGER_COUNT; i++) {
    printCalibrationLine(fingers[i], i + 1);
  }
}

void saveCurlForAll(int smoothValues[]) {
  for (int i = 0; i < activeFingerCount; i++) {
    int medianValue = measureMedianSample(fingers[i].pin);
    saveCurlCalibration(fingers[i], medianValue);
  }

  saveCalibration();

  Serial.println("# Saved CURL for all active fingers");

  for (int i = 0; i < FINGER_COUNT; i++) {
    printCalibrationLine(fingers[i], i + 1);
  }
}

void resetAllCalibration() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    resetCalibration(fingers[i]);
  }

  deleteCalibration();

  Serial.println("# Reset calibration for all fingers");

  for (int i = 0; i < FINGER_COUNT; i++) {
    printCalibrationLine(fingers[i], i + 1);
  }
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