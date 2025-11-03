#!/usr/bin/env bash
set -e

WEIGHTS_URL="https://github.com/hse-aml/Sign-Language-Recognition/releases/download/v1.0/gesture_classifier.tflite"
OUT_DIR="backend/models"
OUT_FILE="$OUT_DIR/gesture_weights.tflite"

mkdir -p "$OUT_DIR"

echo "Downloading gesture recognition weights..."
curl -L -o "$OUT_FILE" "$WEIGHTS_URL"

echo "Gesture model downloaded to $OUT_FILE"
