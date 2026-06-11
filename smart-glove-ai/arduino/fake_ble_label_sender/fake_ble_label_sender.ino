// Smart Glove 5-Finger Calibration + CSV Percent Stream
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
// p  = print calibration status
// m  = toggle mode: STATUS / CSV
// r  = reset calibration

const int SERIAL_SPEED = 115200;

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

int readings[FINGER_COUNT][WINDOW_SIZE];
long totals[FINGER_COUNT];
int readIndex = 0;

int rawValues[FINGER_COUNT];
int smoothValues[FINGER_COUNT];

int openValues[FINGER_COUNT];
int bentValues[FINGER_COUNT];

bool csvMode = false;

char commandBuffer[16];
int commandIndex = 0;

void setup() {
  Serial.begin(SERIAL_SPEED);
  analogReadResolution(12);

  delay(1000);

  for (int f = 0; f < FINGER_COUNT; f++) {
    openValues[f] = -1;
    bentValues[f] = -1;
    totals[f] = 0;

    for (int i = 0; i < WINDOW_SIZE; i++) {
      readings[f][i] = analogRead(pins[f]);
      totals[f] += readings[f][i];
    }
  }

  printHelp();
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
  else if (equals(cmd, "p")) {
    printCalibrationStatus();
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
    resetCalibration();
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

int computePercent(int finger, int smooth) {
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

  int finalPercent = constrain((int)percent, 0, 100);

  if (finalPercent < 8) {
    finalPercent = 0;
  }

  return finalPercent;
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

    Serial.print(" percent=");
    printValueOrNA(percent);

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

    Serial.print("# ");
    Serial.print(f + 1);
    Serial.print(": ");
    Serial.print(names[f]);

    Serial.print(" pin=A");
    Serial.print(f);

    Serial.print(" open=");
    printValueOrNA(openValues[f]);

    Serial.print(" bent=");
    printValueOrNA(bentValues[f]);

    Serial.print(" range=");
    printValueOrNA(range);

    Serial.print(" quality=");
    if (range == -1) {
      Serial.print("N/A");
    } else {
      printQuality(range);
    }

    Serial.println();
  }

  Serial.println();
}

int getRange(int finger) {
  if (openValues[finger] == -1 || bentValues[finger] == -1) {
    return -1;
  }

  return abs(openValues[finger] - bentValues[finger]);
}

void printQuality(int range) {
  if (range < 40) {
    Serial.print("BAD");
  } else if (range < 80) {
    Serial.print("WEAK_BUT_USABLE");
  } else if (range < 150) {
    Serial.print("USABLE");
  } else {
    Serial.print("GOOD");
  }
}

void resetCalibration() {
  for (int f = 0; f < FINGER_COUNT; f++) {
    openValues[f] = -1;
    bentValues[f] = -1;
  }

  csvMode = false;

  Serial.println("# Calibration reset.");
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
  Serial.println("# Smart Glove 5-Finger Calibration + CSV Percent Stream");
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
  Serial.println("# p  = print calibration status");
  Serial.println("# m  = toggle STATUS / CSV mode");
  Serial.println("# r  = reset calibration");
  Serial.println();
}