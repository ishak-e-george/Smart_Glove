// Smart Glove: 3-Finger Calibration Tool + Visualizer Telemetry
// Board: Arduino Nano 33 BLE Rev2
//
// Fingers:
// A0 = Index
// A1 = Middle
// A2 = Ring
//
// Commands in Serial Monitor:
// f = save current position as FLAT / OPEN for all 3 fingers
// c = save current position as CURL / BENT for all 3 fingers
// r = reset calibration for all 3 fingers

const int SERIAL_SPEED = 115200;
const int READ_DELAY_MS = 120;
const int WINDOW_SIZE = 10;

const int MIN_USABLE_RANGE = 50;
const int GOOD_RANGE = 150;
const int VERY_GOOD_RANGE = 300;
const int EXCELLENT_RANGE = 700;

const int ADC_LOW_LIMIT = 2;
const int ADC_HIGH_LIMIT = 4093;

struct FingerCal {
  const char* name;
  int pin;
  int readings[WINDOW_SIZE];
  int readIndex;
  long total;
  int flatValue;
  int curlValue;
};

FingerCal fingers[3] = {
  {"INDEX",  A0, {0}, 0, 0, -1, -1},
  {"MIDDLE", A1, {0}, 0, 0, -1, -1},
  {"RING",   A2, {0}, 0, 0, -1, -1}
};

int updateSmooth(FingerCal &finger, int raw);
void handleCommands(int smoothValues[]);
int getRange(const FingerCal &finger);
int getPercent(const FingerCal &finger, int smooth);
String getState(const FingerCal &finger, int percent);
String getQuality(int range);
void printFingerDashboard(const FingerCal &finger, int raw, int smooth);
void printSmartWarnings(const FingerCal &finger, int smooth, int range);
void printVisualizerFrame(int smoothValues[]);

void setup() {
  Serial.begin(SERIAL_SPEED);
  analogReadResolution(12);
  delay(1000);

  for (int i = 0; i < 3; i++) {
    fingers[i].total = 0;
    fingers[i].readIndex = 0;

    for (int j = 0; j < WINDOW_SIZE; j++) {
      int v = analogRead(fingers[i].pin);
      fingers[i].readings[j] = v;
      fingers[i].total += v;
    }
  }

  Serial.println();
  Serial.println("=== SMART GLOVE 3-FINGER CALIBRATION ===");
  Serial.println("Pins:");
  Serial.println("A0 = INDEX");
  Serial.println("A1 = MIDDLE");
  Serial.println("A2 = RING");
  Serial.println();
  Serial.println("Commands:");
  Serial.println("f = save FLAT / OPEN for all 3 fingers");
  Serial.println("c = save CURL / BENT for all 3 fingers");
  Serial.println("r = reset all calibration");
  Serial.println("========================================");
  Serial.println();
}

void loop() {
  int rawValues[3];
  int smoothValues[3];

  for (int i = 0; i < 3; i++) {
    rawValues[i] = analogRead(fingers[i].pin);
    smoothValues[i] = updateSmooth(fingers[i], rawValues[i]);
  }

  handleCommands(smoothValues);
  printVisualizerFrame(smoothValues);

  Serial.println("------------------------------------------------------------");
  for (int i = 0; i < 3; i++) {
    printFingerDashboard(fingers[i], rawValues[i], smoothValues[i]);
    Serial.println();
  }

  delay(READ_DELAY_MS);
}

int updateSmooth(FingerCal &finger, int raw) {
  finger.total -= finger.readings[finger.readIndex];
  finger.readings[finger.readIndex] = raw;
  finger.total += finger.readings[finger.readIndex];

  finger.readIndex++;
  if (finger.readIndex >= WINDOW_SIZE) {
    finger.readIndex = 0;
  }

  return finger.total / WINDOW_SIZE;
}

void handleCommands(int smoothValues[]) {
  if (!Serial.available()) {
    return;
  }

  char cmd = Serial.read();
  while (Serial.available()) {
    Serial.read();
  }

  if (cmd == 'f' || cmd == 'F') {
    Serial.println();
    Serial.println("Saving FLAT values...");
    for (int i = 0; i < 3; i++) {
      fingers[i].flatValue = smoothValues[i];
      Serial.print(fingers[i].name);
      Serial.print(" FLAT = ");
      Serial.println(fingers[i].flatValue);
    }
    Serial.println();
  }

  if (cmd == 'c' || cmd == 'C') {
    Serial.println();
    Serial.println("Saving CURL values...");
    for (int i = 0; i < 3; i++) {
      fingers[i].curlValue = smoothValues[i];
      Serial.print(fingers[i].name);
      Serial.print(" CURL = ");
      Serial.print(fingers[i].curlValue);
      Serial.print(" | RANGE = ");
      Serial.println(getRange(fingers[i]));
    }
    Serial.println();
  }

  if (cmd == 'r' || cmd == 'R') {
    for (int i = 0; i < 3; i++) {
      fingers[i].flatValue = -1;
      fingers[i].curlValue = -1;
    }

    Serial.println();
    Serial.println("All calibration reset.");
    Serial.println();
  }
}

int getRange(const FingerCal &finger) {
  if (finger.flatValue == -1 || finger.curlValue == -1) {
    return -1;
  }
  return abs(finger.curlValue - finger.flatValue);
}

int getPercent(const FingerCal &finger, int smooth) {
  if (finger.flatValue == -1 || finger.curlValue == -1) {
    return -1;
  }

  int range = getRange(finger);
  if (range < MIN_USABLE_RANGE) {
    return -1;
  }

  float percent = ((float)(smooth - finger.flatValue) / (float)(finger.curlValue - finger.flatValue)) * 100.0;
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;

  return (int)percent;
}

String getState(const FingerCal &finger, int percent) {
  if (finger.flatValue == -1 || finger.curlValue == -1) {
    return "UNCALIBRATED";
  }

  int range = getRange(finger);
  if (range < MIN_USABLE_RANGE) {
    return "BAD_RANGE";
  }

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

void printFingerDashboard(const FingerCal &finger, int raw, int smooth) {
  int range = getRange(finger);
  int percent = getPercent(finger, smooth);
  String state = getState(finger, percent);
  String quality = getQuality(range);

  Serial.print(finger.name);
  Serial.print(" | RAW=");
  Serial.print(raw);
  Serial.print(" | SMOOTH=");
  Serial.print(smooth);
  Serial.print(" | FLAT=");
  Serial.print(finger.flatValue);
  Serial.print(" | CURL=");
  Serial.print(finger.curlValue);
  Serial.print(" | RANGE=");
  if (range == -1) Serial.print("N/A");
  else Serial.print(range);
  Serial.print(" | QUALITY=");
  Serial.print(quality);
  Serial.print(" | PERCENT=");
  if (percent == -1) Serial.print("N/A");
  else {
    Serial.print(percent);
    Serial.print("%");
  }
  Serial.print(" | STATE=");
  Serial.print(state);

  printSmartWarnings(finger, smooth, range);
}

void printSmartWarnings(const FingerCal &finger, int smooth, int range) {
  if (finger.flatValue == -1 || finger.curlValue == -1) {
    if (smooth <= ADC_LOW_LIMIT) {
      Serial.print(" <-- POSSIBLE GND SHORT");
    }
    if (smooth >= ADC_HIGH_LIMIT) {
      Serial.print(" <-- POSSIBLE 3.3V SHORT");
    }
    return;
  }

  if (range < MIN_USABLE_RANGE) {
    Serial.print(" <-- RANGE TOO SMALL");
    return;
  }

  if (smooth <= ADC_LOW_LIMIT) {
    Serial.print(" <-- STUCK NEAR 0");
  }

  if (smooth >= ADC_HIGH_LIMIT) {
    Serial.print(" <-- STUCK NEAR 4095");
  }
}

void printVisualizerFrame(int smoothValues[]) {
  Serial.print("VIS");

  for (int i = 0; i < 3; i++) {
    int range = getRange(fingers[i]);
    int percent = getPercent(fingers[i], smoothValues[i]);
    String state = getState(fingers[i], percent);
    String quality = getQuality(range);

    Serial.print(",");
    Serial.print(smoothValues[i]);
    Serial.print(",");
    if (percent == -1) Serial.print(0);
    else Serial.print(percent);
    Serial.print(",");
    Serial.print(state);
    Serial.print(",");
    if (range == -1) Serial.print(0);
    else Serial.print(range);
    Serial.print(",");
    Serial.print(quality);
  }

  Serial.println();
}
