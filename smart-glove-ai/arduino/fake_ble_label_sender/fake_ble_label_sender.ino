// Smart Glove 5-Finger Persistent Calibration + CSV Percent Stream
// Board: Arduino Nano 33 BLE Rev2
//
// Final wiring per finger:
// 3.3V -> flex sensor -> analog pin -> 43k resistor -> GND
// analog pin -> 0.1uF capacitor -> GND
//
// Pins:
// INDEX  = A0
// MIDDLE = A1
// RING   = A2
// PINKY  = A3
// THUMB  = A4
//
// Serial Monitor:
// 115200 baud
// New Line
//
// Commands:
// h  = help
// o  = calibrate OPEN for all fingers
// b1 = calibrate INDEX bent
// b2 = calibrate MIDDLE bent
// b3 = calibrate RING bent
// b4 = calibrate PINKY bent
// b5 = calibrate THUMB bent
// z  = rest-zero calibration
// p  = print calibration status
// s  = save calibration to flash
// l  = load calibration from flash
// e  = erase saved calibration from flash
// m  = toggle mode: STATUS / CSV
// r  = reset calibration in RAM only

#include <Arduino.h>
#include "kvstore_global_api.h"

const int SERIAL_SPEED = 115200;
const int KV_SUCCESS = 0;

const int FINGER_COUNT = 5;

const int pins[FINGER_COUNT] = {
  A0, A1, A2, A3, A4
};

const char* names[FINGER_COUNT] = {
  "INDEX", "MIDDLE", "RING", "PINKY", "THUMB"
};

const int WINDOW_SIZE = 10;
const int SAMPLE_COUNT = 100;
const int SAMPLE_DELAY_MS = 3;
const int LOOP_DELAY_MS = 120;

const char* KV_KEY = "/kv/smart_glove_5f_calibration";

const uint32_t CAL_MAGIC = 0x53473546; // SG5F
const uint16_t CAL_VERSION = 1;

int readings[FINGER_COUNT][WINDOW_SIZE];
long totals[FINGER_COUNT];
int readIndex = 0;

int rawValues[FINGER_COUNT];
int smoothValues[FINGER_COUNT];

int openValues[FINGER_COUNT];
int bentValues[FINGER_COUNT];
int zeroValues[FINGER_COUNT];

// Deadzone after rest-zero.
// These help keep REST stable at 0.
int deadZones[FINGER_COUNT] = {
  25, 30, 25, 45, 25
};

const int defaultDeadZones[FINGER_COUNT] = {
  25, 30, 25, 45, 25
};

bool csvMode = false;

char commandBuffer[16];
int commandIndex = 0;

struct CalibrationData {
  uint32_t magic;
  uint16_t version;
  uint16_t fingerCount;

  int openValues[FINGER_COUNT];
  int bentValues[FINGER_COUNT];
  int zeroValues[FINGER_COUNT];
  int deadZones[FINGER_COUNT];

  uint32_t checksum;
};

void setup() {
  Serial.begin(SERIAL_SPEED);
  analogReadResolution(12);

  delay(1000);

  resetCalibrationRAM();

  for (int f = 0; f < FINGER_COUNT; f++) {
    totals[f] = 0;

    for (int i = 0; i < WINDOW_SIZE; i++) {
      readings[f][i] = analogRead(pins[f]);
      totals[f] += readings[f][i];
    }

    rawValues[f] = readings[f][0];
    smoothValues[f] = totals[f] / WINDOW_SIZE;
  }

  printHelp();

  if (loadCalibrationFromFlash(false)) {
    Serial.println("# Saved calibration loaded from flash.");
    printCalibrationStatus();
  } else {
    Serial.println("# No valid saved calibration found.");
    Serial.println("# Calibrate using: o, b1, b2, b3, b4, b5, z, p, s, m");
  }
}

void loop() {
  updateReadings();
  handleSerialCommands();

  if (csvMode) {
    printCSV();
  } else {
    printLiveStatus();
  }

  delay(LOOP_DELAY_MS);
}

void updateReadings() {
  for (int f = 0; f < FINGER_COUNT; f++) {
    int raw = analogRead(pins[f]);
    rawValues[f] = raw;

    totals[f] -= readings[f][readIndex];
    readings[f][readIndex] = raw;
    totals[f] += raw;

    smoothValues[f] = totals[f] / WINDOW_SIZE;
  }

  readIndex = (readIndex + 1) % WINDOW_SIZE;
}

void handleSerialCommands() {
  while (Serial.available()) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      if (commandIndex > 0) {
        commandBuffer[commandIndex] = '\0';
        processCommand(commandBuffer);
        commandIndex = 0;
      }
    } else {
      if (commandIndex < 15) {
        commandBuffer[commandIndex++] = c;
      }
    }
  }
}

void processCommand(char* cmd) {
  toLowerCase(cmd);

  if (equals(cmd, "h")) {
    printHelp();
  }
  else if (equals(cmd, "o")) {
    calibrateOpenAll();
  }
  else if (equals(cmd, "b1")) {
    calibrateBentFinger(0);
  }
  else if (equals(cmd, "b2")) {
    calibrateBentFinger(1);
  }
  else if (equals(cmd, "b3")) {
    calibrateBentFinger(2);
  }
  else if (equals(cmd, "b4")) {
    calibrateBentFinger(3);
  }
  else if (equals(cmd, "b5")) {
    calibrateBentFinger(4);
  }
  else if (equals(cmd, "z")) {
    calibrateRestZero();
  }
  else if (equals(cmd, "p")) {
    printCalibrationStatus();
  }
  else if (equals(cmd, "s")) {
    saveCalibrationToFlash();
  }
  else if (equals(cmd, "l")) {
    loadCalibrationFromFlash(true);
  }
  else if (equals(cmd, "e")) {
    eraseCalibrationFromFlash();
  }
  else if (equals(cmd, "m")) {
    csvMode = !csvMode;

    if (csvMode) {
      Serial.println("# Mode changed to CSV");
      Serial.println("# index,middle,ring,pinky,thumb");
    } else {
      Serial.println("# Mode changed to STATUS");
    }
  }
  else if (equals(cmd, "r")) {
    resetCalibrationRAM();
    csvMode = false;
    Serial.println("# Calibration reset in RAM only.");
    Serial.println("# Saved flash calibration was NOT erased.");
    Serial.println("# Use e to erase saved flash calibration.");
  }
  else {
    Serial.print("# Unknown command: ");
    Serial.println(cmd);
    Serial.println("# Type h for help.");
  }
}

void calibrateOpenAll() {
  Serial.println("# Keep ALL fingers OPEN and still.");
  Serial.println("# Sampling in 1 second...");
  delay(1000);

  for (int f = 0; f < FINGER_COUNT; f++) {
    openValues[f] = medianSample(pins[f]);
    zeroValues[f] = 0;
  }

  Serial.println("# OPEN calibration saved for all fingers.");
  printCalibrationStatus();
}

void calibrateBentFinger(int finger) {
  Serial.print("# Keep ");
  Serial.print(names[finger]);
  Serial.println(" fully BENT safely and still.");
  Serial.println("# Sampling in 1 second...");
  delay(1000);

  bentValues[finger] = medianSample(pins[finger]);

  Serial.print("# Saved ");
  Serial.print(names[finger]);
  Serial.print(" BENT = ");
  Serial.println(bentValues[finger]);

  printCalibrationStatus();
}

void calibrateRestZero() {
  Serial.println("# Relax hand OPEN/REST and keep it still.");
  Serial.println("# Sampling rest-zero in 1 second...");
  delay(1000);

  for (int f = 0; f < FINGER_COUNT; f++) {
    int restRaw = medianSample(pins[f]);
    int basePercent = computeBasePercent(f, restRaw);

    if (basePercent == -1) {
      zeroValues[f] = 0;
    } else {
      zeroValues[f] = constrain(basePercent, 0, 100);
    }
  }

  Serial.println("# Rest-zero calibration saved in RAM.");
  Serial.println("# Send s to save it to flash.");
  printCalibrationStatus();
}

int medianSample(int pin) {
  int samples[SAMPLE_COUNT];

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    samples[i] = analogRead(pin);
    delay(SAMPLE_DELAY_MS);
  }

  sortSamples(samples, SAMPLE_COUNT);

  return samples[SAMPLE_COUNT / 2];
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

int computeBasePercent(int finger, int smooth) {
  if (openValues[finger] == -1 || bentValues[finger] == -1) {
    return -1;
  }

  int openValue = openValues[finger];
  int bentValue = bentValues[finger];
  int range = abs(openValue - bentValue);

  if (range < 20) {
    return -1;
  }

  float percent;

  if (bentValue > openValue) {
    percent = ((float)(smooth - openValue) / (float)range) * 100.0;
  } else {
    percent = ((float)(openValue - smooth) / (float)range) * 100.0;
  }

  return constrain((int)percent, 0, 100);
}

int computePercent(int finger, int smooth) {
  int basePercent = computeBasePercent(finger, smooth);

  if (basePercent == -1) {
    return -1;
  }

  int adjusted = basePercent - zeroValues[finger];

  if (adjusted < deadZones[finger]) {
    adjusted = 0;
  }

  adjusted = constrain(adjusted, 0, 100);

  return adjusted;
}

void printLiveStatus() {
  for (int f = 0; f < FINGER_COUNT; f++) {
    int percent = computePercent(f, smoothValues[f]);
    int range = getRange(f);

    Serial.print(names[f]);

    Serial.print(" raw=");
    Serial.print(rawValues[f]);

    Serial.print(" smooth=");
    Serial.print(smoothValues[f]);

    Serial.print(" open=");
    printValueOrNA(openValues[f]);

    Serial.print(" bent=");
    printValueOrNA(bentValues[f]);

    Serial.print(" range=");
    printValueOrNA(range);

    Serial.print(" zero=");
    Serial.print(zeroValues[f]);
    Serial.print("%");

    Serial.print(" dz=");
    Serial.print(deadZones[f]);
    Serial.print("%");

    Serial.print(" now=");
    printValueOrNA(percent);
    Serial.print("%");

    if (range != -1) {
      Serial.print(" quality=");
      printQuality(range);
    }

    if (f < FINGER_COUNT - 1) {
      Serial.print(" | ");
    }
  }

  Serial.println();
}

void printCSV() {
  for (int f = 0; f < FINGER_COUNT; f++) {
    int percent = computePercent(f, smoothValues[f]);

    if (percent == -1) {
      percent = 0;
    }

    Serial.print(percent);

    if (f < FINGER_COUNT - 1) {
      Serial.print(",");
    }
  }

  Serial.println();
}

void printCalibrationStatus() {
  Serial.println();
  Serial.println("# Calibration status:");

  for (int f = 0; f < FINGER_COUNT; f++) {
    int range = getRange(f);
    int nowPercent = computePercent(f, smoothValues[f]);

    Serial.print("# ");
    Serial.print(f + 1);
    Serial.print(":");
    Serial.print(names[f]);

    Serial.print(" open=");
    printValueOrNA(openValues[f]);

    Serial.print(" bent=");
    printValueOrNA(bentValues[f]);

    Serial.print(" range=");
    printValueOrNA(range);

    Serial.print(" zero=");
    Serial.print(zeroValues[f]);
    Serial.print("%");

    Serial.print(" dz=");
    Serial.print(deadZones[f]);
    Serial.print("%");

    Serial.print(" now=");
    printValueOrNA(nowPercent);
    Serial.print("%");

    Serial.print(" quality=");
    if (range == -1) {
      Serial.print("N/A");
    } else {
      printQuality(range);
    }

    Serial.println();
  }

  Serial.print("# Mode: ");
  Serial.println(csvMode ? "CSV" : "STATUS");
  Serial.println();
}

int getRange(int finger) {
  if (openValues[finger] == -1 || bentValues[finger] == -1) {
    return -1;
  }

  return abs(openValues[finger] - bentValues[finger]);
}

void printQuality(int range) {
  if (range < 20) {
    Serial.print("BAD");
  } else if (range < 40) {
    Serial.print("WEAK_DEMO");
  } else if (range < 80) {
    Serial.print("WEAK");
  } else if (range < 150) {
    Serial.print("USABLE");
  } else {
    Serial.print("GOOD");
  }
}

void resetCalibrationRAM() {
  for (int f = 0; f < FINGER_COUNT; f++) {
    openValues[f] = -1;
    bentValues[f] = -1;
    zeroValues[f] = 0;
    deadZones[f] = defaultDeadZones[f];
  }
}

void saveCalibrationToFlash() {
  if (!isCalibrationComplete()) {
    Serial.println("# ERROR: Calibration is incomplete.");
    Serial.println("# Required workflow: o, b1, b2, b3, b4, b5, z, then s");
    return;
  }

  CalibrationData data;

  data.magic = CAL_MAGIC;
  data.version = CAL_VERSION;
  data.fingerCount = FINGER_COUNT;

  for (int f = 0; f < FINGER_COUNT; f++) {
    data.openValues[f] = openValues[f];
    data.bentValues[f] = bentValues[f];
    data.zeroValues[f] = zeroValues[f];
    data.deadZones[f] = deadZones[f];
  }

  data.checksum = 0;
  data.checksum = calculateChecksum((const uint8_t*)&data, sizeof(CalibrationData));

  int result = kv_set(KV_KEY, &data, sizeof(CalibrationData), 0);

  if (result == KV_SUCCESS) {
    Serial.println("# Calibration saved to flash successfully.");
  } else {
    Serial.print("# ERROR: Failed to save calibration to flash. Code=");
    Serial.println(result);
  }
}

bool loadCalibrationFromFlash(bool printMessages) {
  CalibrationData data;
  size_t actualSize = 0;

  int result = kv_get(KV_KEY, &data, sizeof(CalibrationData), &actualSize);

  if (result != KV_SUCCESS || actualSize != sizeof(CalibrationData)) {
    if (printMessages) {
      Serial.print("# ERROR: No valid calibration found in flash. Code=");
      Serial.println(result);
    }
    return false;
  }

  uint32_t savedChecksum = data.checksum;
  data.checksum = 0;
  uint32_t computedChecksum = calculateChecksum((const uint8_t*)&data, sizeof(CalibrationData));

  if (data.magic != CAL_MAGIC ||
      data.version != CAL_VERSION ||
      data.fingerCount != FINGER_COUNT ||
      savedChecksum != computedChecksum) {
    if (printMessages) {
      Serial.println("# ERROR: Flash calibration exists but is invalid/corrupted.");
    }
    return false;
  }

  for (int f = 0; f < FINGER_COUNT; f++) {
    openValues[f] = data.openValues[f];
    bentValues[f] = data.bentValues[f];
    zeroValues[f] = data.zeroValues[f];
    deadZones[f] = data.deadZones[f];
  }

  if (printMessages) {
    Serial.println("# Calibration loaded from flash successfully.");
    printCalibrationStatus();
  }

  return true;
}

void eraseCalibrationFromFlash() {
  int result = kv_remove(KV_KEY);

  if (result == KV_SUCCESS) {
    Serial.println("# Saved calibration erased from flash.");
  } else {
    Serial.print("# ERROR: Failed to erase calibration or nothing was saved. Code=");
    Serial.println(result);
  }

  resetCalibrationRAM();
  csvMode = false;
}

bool isCalibrationComplete() {
  for (int f = 0; f < FINGER_COUNT; f++) {
    if (openValues[f] == -1 || bentValues[f] == -1) {
      return false;
    }

    if (getRange(f) < 20) {
      return false;
    }
  }

  return true;
}

uint32_t calculateChecksum(const uint8_t* data, size_t length) {
  uint32_t checksum = 2166136261UL;

  for (size_t i = 0; i < length; i++) {
    checksum ^= data[i];
    checksum *= 16777619UL;
  }

  return checksum;
}

void printValueOrNA(int value) {
  if (value == -1) {
    Serial.print("N/A");
  } else {
    Serial.print(value);
  }
}

bool equals(char* a, const char* b) {
  int i = 0;

  while (a[i] != '\0' && b[i] != '\0') {
    if (a[i] != b[i]) {
      return false;
    }

    i++;
  }

  return a[i] == '\0' && b[i] == '\0';
}

void toLowerCase(char* text) {
  for (int i = 0; text[i] != '\0'; i++) {
    if (text[i] >= 'A' && text[i] <= 'Z') {
      text[i] = text[i] + 32;
    }
  }
}

void printHelp() {
  Serial.println();
  Serial.println("# Smart Glove 5-Finger Persistent Calibration + CSV Percent Stream");
  Serial.println("# Board: Arduino Nano 33 BLE Rev2");
  Serial.println("# Wiring: 3.3V -> flex -> analog pin -> 43k resistor -> GND");
  Serial.println("# Capacitor: analog pin -> 0.1uF -> GND");
  Serial.println("# Serial Monitor: 115200 baud, New Line");
  Serial.println();
  Serial.println("# Commands:");
  Serial.println("# h  = help");
  Serial.println("# o  = calibrate OPEN for all fingers");
  Serial.println("# b1 = calibrate INDEX bent");
  Serial.println("# b2 = calibrate MIDDLE bent");
  Serial.println("# b3 = calibrate RING bent");
  Serial.println("# b4 = calibrate PINKY bent");
  Serial.println("# b5 = calibrate THUMB bent");
  Serial.println("# z  = rest-zero calibration");b4
  
  Serial.println("# p  = print calibration status");
  Serial.println("# s  = save calibration to flash");
  Serial.println("# l  = load calibration from flash");
  Serial.println("# e  = erase saved calibration from flash");
  Serial.println("# m  = toggle STATUS / CSV mode");
  Serial.println("# r  = reset calibration in RAM only");
  Serial.println();
  Serial.println("# Recommended workflow:");
  Serial.println("# 1. Wear glove and relax hand open");
  Serial.println("# 2. Send: o");
  Serial.println("# 3. Bend Index, send: b1");
  Serial.println("# 4. Bend Middle, send: b2");
  Serial.println("# 5. Bend Ring, send: b3");
  Serial.println("# 6. Bend Pinky, send: b4");
  Serial.println("# 7. Bend Thumb, send: b5");
  Serial.println("# 8. Relax hand open again, send: z");
  Serial.println("# 9. Send: p");
  Serial.println("# 10. Send: s");
  Serial.println("# 11. Send: m");
  Serial.println();
}
