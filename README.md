

# Signify – AI-Powered Communication Platform

**Signify** is a real-time, AI-driven communication platform that bridges the gap between **spoken language, sign language, and emotional context** using open-source, locally hosted AI models.
It is designed for accessibility, inclusivity, and offline functionality — empowering individuals who rely on sign language or non-verbal communication to interact seamlessly with others and with digital systems.

---

##  Concept Overview

Signify acts as a **multimodal translator** between gesture, voice, text, and emotional cues.
It enables two-way communication between sign language users and speakers, ensuring understanding even across communication barriers.
The platform intelligently analyzes visual gestures, facial expressions, and vocal signals, converting them into coherent text, audio, or visual responses — entirely processed locally without cloud dependencies.

---

## ⚙️ Core Features

### 1.  Gesture Recognition

* Uses **MediaPipe Holistic** to extract landmarks from the user’s hands, body, and face.
* Feeds the processed landmarks into a **TensorFlow Lite gesture classification model**.
* Recognizes a range of common sign gestures such as “HELLO,” “THANK YOU,” “YES,” “NO,” and “PLEASE.”
* Provides real-time gesture-to-text translation displayed within the user interface.
* Works fully offline and lightweight, suitable for edge deployment (e.g., Raspberry Pi, Jetson).

---

### 2.  Emotion Recognition

* Detects **facial expressions** and micro-movements using camera input.
* Analyzes emotional states such as happiness, sadness, surprise, anger, or neutrality.
* Supports adaptive responses — e.g., adjusting speech tone or providing visual empathy cues.
* Enables emotionally aware interactions, enhancing clarity and empathy in communication.

---

### 3.  Speech Recognition (ASR)

* Converts spoken audio into text using an open-source model such as **VOSK**.
* Functions entirely offline — no internet or cloud API required.
* Supports multiple languages and accent variations.
* Enables non-signers to speak naturally while the system transcribes and relays the text or gesture response.

---

### 4.  Text-to-Speech (TTS)

* Synthesizes natural speech from text using **pyttsx3** for local processing.
* Responds with spoken output in conversational tone.
* Allows sign language users to “speak” using recognized gestures that the system vocalizes.

---

### 5.  LangFlow Orchestration

* The AI workflow is fully visualized and orchestrated via **LangFlow**, connecting all modules:

  * Gesture → Text
  * Emotion → Context Adjuster
  * ASR → Text Parser
  * Text → TTS
* Ensures modular expandability: any open-source model can replace an existing block without architectural change.
* Exports the entire flow (`flow_export.yaml`) for reproducibility and transparency.

---

### 6.  Audio Hashing & Traceability

* Implements a **cryptographic audio hashing** feature to uniquely identify each input.
* Ensures verifiable evidence and traceability for recorded communications.
* Enables auditability and trust in accessibility applications or AI-mediated conversations.

---

### 7.  Real-Time WebSocket Communication

* A lightweight **FastAPI + WebSocket backend** supports live bi-directional communication.
* The frontend streams gesture, voice, and emotion data simultaneously.
* Supports live sessions where gestures and speech are transcribed and played back with near-zero latency.

---

### 8.  Contextual AI Layer

* An intelligent reasoning layer interprets gesture and emotion data together to infer **context** (e.g., politeness, urgency, affirmation).
* Can adapt responses dynamically — for instance, toning down TTS output if the user appears upset.
* Optional integration with local LLMs (e.g., Llama.cpp) for natural-language contextualization.

---

##  System Architecture

**Frontend (React)**

* Captures webcam and microphone streams.
* Sends encoded frames and audio data to the backend through WebSocket channels.
* Displays recognized gestures, transcribed text, and emotions in real time.

**Backend (FastAPI)**

* Manages the ASR, gesture, emotion, and TTS pipelines.
* Provides `/api` endpoints for discrete tasks (hashing, metadata, etc.) and `/ws` for live interaction.
* All inference is performed locally for privacy and offline functionality.

**LangFlow Integration**

* Visual orchestration of the end-to-end workflow (data flow, model invocation, output fusion).
* Each functional component (gesture recognition, ASR, emotion analysis, TTS) is a connected node in the LangFlow graph.

---

##  Design Philosophy

1. **Offline-First** – No cloud APIs; fully functional without an internet connection.
2. **Open-Source Stack** – Every model and library used is community-driven and locally hosted.
3. **Accessibility Focused** – Designed to empower sign language users and promote inclusive communication.
4. **Lightweight** – Optimized for CPU inference and minimal dependencies, runnable on modest hardware.
5. **Modular and Extensible** – Each AI module can be replaced or upgraded independently.


---


##  System Flow Summary

Below is a simplified overview of how data travels through Signify’s multimodal AI pipeline:

```
                   ┌────────────────────┐
                   │   User Input       │
                   │ (Camera + Mic)     │
                   └────────┬───────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
 ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
 │ Gesture Stream │  │ Emotion Stream │  │  Audio Stream  │
 │ (Hands/Body)   │  │ (Facial cues)  │  │ (Speech Input) │
 └───────┬────────┘  └───────┬────────┘  └──────┬─────────┘
         │                   │                   │
         ▼                   ▼                   ▼
 ┌───────────────┐   ┌────────────────┐   ┌────────────────┐
 │ MediaPipe     │   │ MediaPipe Face │   │   VOSK ASR     │
 │ Landmark Model│   │ + Emotion CNN  │   │ (Speech → Text)│
 └───────┬────────┘   └──────┬────────┘   └──────┬─────────┘
         │                   │                   │
         ▼                   ▼                   ▼
 ┌───────────────┐   ┌────────────────┐   ┌────────────────┐
 │ Gesture Class │   │ Emotion Class  │   │ Text Transcript │
 │ (TFLite Model)│   │ (Lightweight)  │   │ (Recognized)    │
 └───────┬────────┘   └──────┬────────┘   └──────┬─────────┘
         │                   │                   │
         └──────────────┬────┴──────┬────────────┘
                        │           │
                        ▼           ▼
             ┌────────────────────────────────┐
             │  Context Fusion (LangFlow)      │
             │  - Combines gesture + emotion   │
             │  - Adjusts tone/context         │
             │  - Produces unified response    │
             └────────────────────────────────┘
                            │
                            ▼
             ┌────────────────────────────────┐
             │  Output Layer                   │
             │  - Text Display (Frontend)      │
             │  - Speech Synthesis (TTS)       │
             │  - Optional Emotion Feedback    │
             └────────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │  User Receives     │
                   │  Translated Output │
                   │  (Text/Voice/Visual)│
                   └────────────────────┘
```


---

##  Module Overview

| **Module/File**                        | **Purpose**                                                                   | **Key Responsibilities**                                                                                                                                              | **Interactions**                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **`app.py`**                           | Main entry point for the backend API.                                         | - Hosts REST endpoints for video/audio analysis.<br>- Connects frontend with AI modules.<br>- Handles JSON/base64 inputs and returns results.                         | Calls functions from `gesture_recognition.py`, `emotion.py`, and `asr.py`.             |
| **`gesture_recognition.py`**           | Gesture interpretation engine using MediaPipe and a lightweight TFLite model. | - Extracts body, hand, and face landmarks.<br>- Runs a temporal gesture model to classify movement sequences.<br>- Falls back to heuristic cues if model unavailable. | Receives video frames from API.<br>Feeds recognized gestures to LangFlow fusion layer. |
| **`emotion.py`**                       | Real-time facial emotion recognition module.                                  | - Uses a lightweight CNN or MediaPipe FaceMesh for emotion detection.<br>- Returns primary emotion state (e.g., happy, neutral, sad).                                 | Sends emotion cues to context fusion for combined interpretation.                      |
| **`asr.py`**                           | Audio-to-text module using open-source speech recognition.                    | - Employs VOSK or Whisper small models for local ASR.<br>- Converts user speech to text in real time.                                                                 | Supplies transcribed text to LangFlow/N8N context fusion.                              |
| **`fusion_logic.py`**                  | Central reasoning layer that unites gesture, emotion, and ASR data.           | - Aggregates multimodal signals.<br>- Applies rule-based or LangFlow logic to derive contextual meaning.<br>- Formats structured output for frontend.                 | Receives processed data from all three analysis modules.                               |
| **`n8n_flow/` or `langflow_project/`** | Flow-based orchestration workspace.                                           | - Manages real-time signal routing.<br>- Enables non-linear logic flows using LangFlow or N8N nodes.<br>- Integrates open-source LLM (e.g., Mistral, LLaMA, Phi).     | Interacts with `fusion_logic.py` for semantic processing.                              |
| **`frontend/`**                        | Web-based user interface for Signify.                                         | - Displays live camera feed and translation output.<br>- Sends video/audio streams to backend.<br>- Provides visual and voice feedback.                               | Communicates directly with `app.py` endpoints.                                         |
| **`models/`**                          | Stores AI model weights (TFLite, ONNX, or PyTorch).                           | - Holds gesture and emotion model binaries.<br>- Facilitates offline/edge inference.                                                                                  | Accessed by `gesture_recognition.py` and `emotion.py`.                                 |
| **`utils/`**                           | Helper utilities and preprocessing scripts.                                   | - Common data transformations (resizing, normalization).<br>- Logging, error handling, and visualization tools.                                                       | Used by multiple modules for consistent preprocessing.                                 |
| **`requirements.txt`**                 | Dependency declaration.                                                       | - Lists required libraries (Mediapipe, OpenCV, Torch, etc.).                                                                                                          | Used for local environment setup.                                                      |

---

###  How It All Fits Together

| **Pipeline Phase**     | **Involved Modules**                             | **Output**                                     |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------- |
| **Input Capture**      | Frontend (`frontend/`), `app.py`                 | Raw video/audio streams                        |
| **Preprocessing**      | `gesture_recognition.py`, `emotion.py`, `asr.py` | Landmarks, emotion state, text transcript      |
| **Fusion & Reasoning** | `fusion_logic.py`, `langflow_project/`           | Contextual interpretation (intent + sentiment) |
| **Output Rendering**   | Frontend (`frontend/`), TTS subsystem            | On-screen text and/or spoken translation       |

---


