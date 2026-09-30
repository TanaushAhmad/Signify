# Signify

A five-phrase American Sign Language (ASL) avatar demo built with React, TypeScript, Vite and Three.js. The original dark interface, purple/pink gradients, feature cards and conversation layout are preserved, along with the existing avatar, rig and animation player.

## Run

```sh
npm install
npm run dev
```

Open the printed URL and choose **Start a Conversation**. On Windows with PowerShell restrictions, use `npm.cmd` and `npx.cmd`.

## Five-phrase signing demo

Choose a suggestion or type **Hi**, **Thank you**, **I love you**, **Yes**, or **No**, then choose **Prepare signing** and **Play**. Capitalization, repeated spaces and trailing punctuation are ignored. Other text receives: “Please choose one of the five demo phrases.”

Each phrase has its own bundled animation. Playback includes pause, replay, speed adjustment, synchronized captions and a current-sign indicator. Editing input clears the previous plan. Loading and missing-animation errors are shown explicitly.

The microphone uses browser speech recognition and sends the final transcript through exactly the same phrase matcher. It requires a supported browser, permission, and localhost or HTTPS. Recognition may send audio to the browser provider. Interim transcripts are displayed but never animated.

These are **project-authored, reference-based ASL approximations**, not independently validated signing assets. Their handshapes, positions and movements require review by a qualified ASL signer before being represented as accurate instruction or used for consequential communication. I love you uses the ILY handshape; there is no automatic fingerspelling, word substitution, or full-sentence translation.

References and limitations: [ASL demo asset notes](public/signing/asl-demo/REFERENCES.md). Reference photographs and videos are not redistributed. Regenerate the authored motion files with:

```sh
node scripts/build-demo-assets.mjs
```

## Simulated video-to-speech

The **Video to Speech** tab is labeled **Demo mode — fixed sample output**. Upload a video or enable the camera, then press **Convert video — simulated demo**. The result is always **Thank you**, and browser speech synthesis speaks that same sample. No video analysis or sign recognition runs. Speech replay and stop controls are provided. Camera tracks and uploaded preview URLs are released when no longer needed.

## Integration

`src/signing/demo.ts` is the single five-phrase input adapter for typed and recognized text. It selects exact catalog phrase plans and rejects reused animation sequences across different demo phrases.

`public/signing/catalog.json` declares ASL, the existing `signify-neutral-v1` rig, the five motion files and caption cues. Demo entries use `validation: "reference-demo"`, source and authorship metadata, and deliberately leave reviewer fields blank. This status is visibly disclosed in the player. Validated assets require reviewer metadata, but metadata alone does not certify linguistic accuracy.

`src/signing/motion.ts` loads Three.js animation JSON or named GLB/glTF animations and drives joints, captions and progress from one clock. The current avatar model, rig, animation engine and speech-recognition hook are preserved. The built-in character is a procedural presentation rig; production human rigs need compatible skeletons and matching licensed animations. Automatic retargeting is not implemented.

Expanding coverage requires licensed or authored motions reviewed by qualified ASL signers, plus reviewed phrase plans. Arbitrary sentence translation requires an additional evaluated language-specific pipeline. No recognition or translation service is bundled.

## Verification

```sh
npx tsc --noEmit
npm run lint
npm run build
npm test
```

Playwright uses installed Google Chrome. Tests cover all five suggestion buttons, normalized typed variants, distinct actual animation tracks and joint poses, captions, pause/replay/speed, unsupported input, missing assets, mobile layout, microphone transcript routing, and fixed output for two uploads and camera input.

Microphone recognition, camera media and speech synthesis are mocked in browser tests. They verify integration and cleanup, not physical devices, audible speaker output or ASL accuracy. Live device testing and independent ASL review remain necessary. The avatar is lazy-loaded; Vite may report a nonfatal large Three.js chunk warning.
