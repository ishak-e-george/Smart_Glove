# Smart Glove API Integration Contract

## Base URL
`http://localhost:8000/api/v1`

## 1. Authentication
**Endpoint:** `POST /auth/login`
**Type:** `application/x-www-form-urlencoded`
**Request:**
- `username`: Email
- `password`: Password
**Response:**
- `access_token`: JWT string
- `token_type`: "bearer"

## 2. Device Registration
**Endpoint:** `POST /devices/`
**Auth:** Bearer Token required
**Request (JSON):**
```json
{
  "device_name": "My Left Glove",
  "serial_number": "GLV-L-12345",
  "device_type": "glove-left"
}
```

## 3. Recording Upload (Mock Mode)
**Endpoint:** `POST /recordings/upload`
**Auth:** Bearer Token required
**Type:** `multipart/form-data`
**Body:**
- `file`: The `.json` sensor data file
- `device_id`: Integer ID of the registered device
- `sample_rate`: e.g., 50
- `duration_ms`: e.g., 2000
- `sensor_count`: e.g., 5

## 4. Phrase Translation
**Endpoint:** `GET /phrases/by-gesture/{gesture_id}`
**Auth:** Bearer Token required
**Query Params:**
- `language_code`: "en", "ar", or "fr"
**Response:** Array of phrase objects.

## 5. Prediction Logging
**Endpoint:** `POST /predictions/`
**Auth:** Bearer Token required
**Request (JSON):**
```json
{
  "device_id": 1,
  "predicted_gesture_id": 2,
  "confidence": 0.95,
  "source_type": "mock"
}
```
