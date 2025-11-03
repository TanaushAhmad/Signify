#!/usr/bin/env bash

set -e
mkdir -p backend/models
cd backend/models
if [ -d "vosk-model-small-en-us-0.15" ]; then
  echo "VOSK model already present"
  exit 0
fi
echo "Downloading small VOSK model (this is ~50MB compressed)."
curl -L -o vosk-small.zip https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-small.zip -d .
rm vosk-small.zip
echo "Done. Place contents in backend/models/vosk-model (rename if needed)."
