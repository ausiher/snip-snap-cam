# SNIP SNAP! 📸 // Gesture Retro Film Camera

An interactive web-based camera application combining computer vision gesture tracking with retro 35mm film aesthetics and WebGL face morphs.

---

## 📐 Architecture & Pipeline

```mermaid
flowchart TD
    %% Input Source
    Webcam[📷 Webcam Video Stream] --> Coordinator[app.js Coordinator Loop]
    
    %% Concurrent Detection Channels
    subgraph Detection [Concurrent AI Tracking]
        Coordinator -->|MediaPipe Hands| HandTrack[🫱 Hands Detector]
        Coordinator -->|MediaPipe Face (Alternate Frames)| FaceTrack[👤 Face Landmarker]
    end

    %% Pipeline processing
    HandTrack -->|Corner Coordinates| Viewfinder[📐 Rotated Viewfinder Math]
    FaceTrack -->|478 Landmarks & Scale| WebGLFilter[✨ WebGL Face Morph Engine]

    %% Compositing
    WebGLFilter -->|Deformed Texture| Canvas[🎨 Viewfinder Canvas 2D]
    Viewfinder -->|Focus Region & Aspect Inset| Canvas

    %% Action / Capturing
    Canvas -->|Index Finger Trigger Pull| Capture[📸 Snapshot Captured]
    Capture -->|Random Retro Film Filters| SnapCard[🎞️ 35mm Digital Roll Negative]
    SnapCard -->|Collage Builder (4 Snaps)| Collage[🖼️ Custom 2x2 Grid/Strip/Proof Sheet]
```

---

## ✨ Core Features

1. **🫱 Hand Gesture Viewfinder:** Form a dual-hand "L" shape to spawn a glowing, responsive, and rotatable crop frame. 
2. **✨ WebGL Caricature Filters:** 5 comical facial deformations (Eye, Forehead, Chin, Nose, Mouth size) processed in aspect-ratio invariant GPU shaders. Features a quick toggle HUD (Face Filter & Landmark Mesh).
3. **🔋 Mobile Speedups:** Face tracking executes on alternate frames (30 FPS) and interpolation-smoothed at 60 FPS, saving 50% CPU/GPU usage on mobile.
4. **📸 Shutter Trigger:** Fold either index finger (trigger pull) to capture a photo with randomized retro film grain filters.
5. **🎨 Art Themes & Audio HUD:** Classic, Neon, and Sage color profiles with synthesized sound effects using the Web Audio API.
6. **🖼️ Collage Proof Sheets:** Compile up to 12 shots into polaroids, 35mm strips, or Red Marker annotated 3x4 Contact Sheets.

---

## 🚀 Running Locally

ES6 module architecture requires a local HTTP server to run (bypass CORS policies):

1. **Open terminal** in the project directory.
2. **Start a server:**
   * Node.js: `npx serve .`
   * Python: `python -m http.server 8080`
3. **Open:** `http://localhost:8080`

---

## 📂 Project Map

* [index.html](file:///D:/CODE/AG%20TEST%20PLAYGROUND/retro-film-cam/index.html) — DOM layouts, modals, and overlays.
* [app.js](file:///D:/CODE/AG%20TEST%20PLAYGROUND/retro-film-cam/app.js) — Main animation coordinator loop.
* [style.css](file:///D:/CODE/AG%20TEST%20PLAYGROUND/retro-film-cam/style.css) — Custom responsive CSS.
* `core/` — Core layout and WebGL filters:
  - [FilterEngine.js](file:///D:/CODE/AG%20TEST%20PLAYGROUND/retro-film-cam/core/FilterEngine.js) — WebGL shader deformations.
  - [OneEuroFilter.js](file:///D:/CODE/AG%20TEST%20PLAYGROUND/retro-film-cam/core/OneEuroFilter.js) — Landmark smoothing.
