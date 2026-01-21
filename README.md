# GestureDJ

GestureDJ is a browser-first, gesture-controlled DJ console built with Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, and MediaPipe Hands. Control music using hand gestures captured from your webcam.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. Allow camera access when prompted.

## How to Use

### 1. Load Tracks
- Click the **Load** button on Deck A or Deck B
- Select an audio file (MP3, WAV, OGG, etc.)
- Waveform and duration display automatically

### 2. Manual Controls (UI Buttons)
- **Play/Pause**: Click play button or use hand gesture
- **Volume Slider**: Adjust deck loudness (0-100%)
- **EQ Knobs**: Adjust Low, Mid, High frequencies (-12 to +12 dB)
- **Effects**: Toggle reverb/delay FX
- **Crossfader**: Blend between Deck A and Deck B
- **Loop**: Enable looping with custom loop lengths

### 3. Hand Gestures (Real-Time)

#### Play/Pause
- **Action**: Make a **pinch gesture** (thumb + index finger together) and **hold for 350ms**, then **release**
- **Detection**: Hand must be still (velocity < 0.5)
- **Cooldown**: 800ms between triggers (prevents accidental double-triggers)
- **Deck Assignment**:
  - **Left hand** → Controls Deck A
  - **Right hand** → Controls Deck B

#### EQ Mode (3-Band Equalizer)
- **Entry**: Open your **palm wide** and **hold for 300ms**
- **Visual Feedback**: Debug HUD shows `Mode: EQ_MODE`
- **Control**:
  - **Horizontal movement (X)**: Select frequency band (Low → Mid → High)
  - **Vertical movement (Y)**: Adjust gain (-12 to +12 dB)
  - **Still palm** exits mode automatically
- **Activation**: Palm must be fully open (fingers spread)

#### FX Mode (Effects Control)
- **Entry**: Make a **pinch gesture** and **hold for 200ms**
- **Visual Feedback**: Debug HUD shows `Mode: FX_MODE`
- **Control**:
  - **Horizontal movement**: Adjust effect mix (0-100%)
  - **Vertical movement**: Adjust effect depth
  - **Release pinch** exits mode
- **Available Effects**: Reverb, Delay

#### Jog Control (Seek/Scratch)
- **Activation**: **Pinch OR make a fist** while **rotating your hand**
- **Direction**:
  - **Clockwise**: Fast forward through track
  - **Counter-clockwise**: Rewind through track
- **Sensitivity**: Each radian of rotation = 2 seconds seek
- **Prevention**: Small rotations ignored (0.06 radian deadzone prevents accidental seeks)
- **Behavior**: Emits seek nudges every ~67ms (15 Hz max)

### 4. Debug Mode
- Toggle **Show/Hide Debug** button to display real-time gesture state:
  - **FPS**: Frames per second
  - **Hands**: Number of hands detected (0-2)
  - **Mode**: Current gesture mode (IDLE/EQ_MODE/FX_MODE/JOG_MODE)
  - **Pinch**: Raw/smoothed values, active status, frame confirmation
  - **Fist**: Active status
  - **Rotation**: Angle, delta, jog status
  - **Velocity**: Hand speed
  - **EQ/FX/Jog**: Current control values

## Gesture Thresholds

| Gesture | Activation | Deactivation | Notes |
|---------|-----------|-------------|-------|
| **Pinch** | 0.28 | 0.38 | Distance-normalized, hysteresis |
| **Open Palm** | 1.2 openness | 1.0 openness | Finger spread ratio |
| **Fist** | 0.45 openness | 0.65 openness | Inverse of open palm |
| **Jog Deadzone** | 0.06 rad | — | Ignores small rotations |

## Smoothing & Confirmation

All gestures use exponential moving average (EMA) smoothing to reduce jitter:
- **Position**: Alpha 0.18 (responsive)
- **Pinch**: Alpha 0.2 (stable)
- **Openness**: Alpha 0.2 (finger spread)
- **Rotation**: Alpha 0.15 (hand angle)

Frame confirmation prevents flickering:
- **Pinch**: Requires 2 consecutive frames
- **Open Palm**: Requires 3 consecutive frames
- **Fist**: Requires 2 consecutive frames

## Architecture

### Gesture System (GestureMapperV3)
- **Event-driven architecture**: Mapper emits events (PLAY_PAUSE_TOGGLE, EQ_UPDATE, FX_UPDATE, JOG_NUDGE)
- **State machine**: Transitions between IDLE, EQ_MODE, FX_MODE, JOG_MODE with 1.2s mode lock
- **Distance-invariant**: All features normalized by palm size
- **Hysteresis**: Prevents gesture jitter with upper/lower thresholds

### Hand Tracking (HandTracker)
- MediaPipe Hands API (21 landmarks per hand)
- Real-time normalization: palm center, palm size, pinch distance, finger spread, palm angle, hand velocity
- 30 FPS detection + smoothing

### Audio Engine
- Per-deck nodes: gain, 3-band EQ (BiquadFilters), FX chain (Delay + Convolver)
- Crossfader: Morphs between A and B
- Loop support with custom lengths
- Real-time waveform analysis

## Build & Deploy

### Production Build
```bash
npm run build
npm start
```

### Vercel Deployment
1. Push repo to GitHub
2. Connect to Vercel via dashboard
3. Build command: `npm run build`
4. Deploy automatically on push

## Browser Requirements
- **Chrome/Edge 89+** (MediaPipe Hands support)
- **Firefox 90+**
- **Camera access** required
- **HTTPS** required for production

## Troubleshooting

**Gestures not detected?**
- Ensure good lighting on your hands
- Check camera feed in Debug HUD (top-right)
- Verify hand landmarks visible (yellow dots on palm)
- Try adjusting hand distance from camera

**Audio not playing?**
- Check browser DevTools for audio context errors
- Verify browser allows audio autoplay (usually requires user gesture first)
- Ensure audio file format is supported

**Jog causing freeze?**
- This has been fixed in V3 with deadzone + throttling
- Small rotations are now ignored to prevent micro-seeks

**FX not responding?**
- Ensure pinch is held for 200ms to enter FX mode
- Debug HUD should show `Mode: FX_MODE`
- Release pinch to exit mode

## License
MIT
# Gesture-DJ-
