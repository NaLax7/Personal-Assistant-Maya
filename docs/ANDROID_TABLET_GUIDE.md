# Android Tablet Installation & Desk Setup Guide

This guide walks you through turning any **Android tablet** (Samsung Galaxy Tab, Huawei MediaPad T3/T5, Lenovo Tab, Xiaomi Pad, or older Android 7+ tablets) into an always-on **Maya Companion** smart display.

---

## 1. Requirements

- Android tablet running **Google Chrome** (v80+) or **Microsoft Edge**
- Active Wi-Fi connection
- A hosted HTTPS URL for Maya (or a PC running Maya on the same Wi-Fi network)

> **Huawei & Non-Google-Play Tablets**: Maya installs as a Progressive Web App (PWA) directly from the browser — Google Play Store is **not** required.

---

## 2. Install Maya onto the Tablet Home Screen

### Method A: Hosted HTTPS URL (Fastest — 30 Seconds)
1. Open **Google Chrome** on your Android tablet.
2. Enter your Maya HTTPS web address.
3. Tap **Install** in Maya's top bar, **or** tap Chrome's **⋮** menu (top right) and select **Install app** (on older Chrome versions: **Add to Home screen**).
4. Tap **Install** on the confirmation popup.
5. Open **Maya** from your tablet's app drawer or home screen. It runs full-screen with no browser address bar.

### Method B: Local Home PC / Same Wi-Fi Setup
1. Start Maya on your computer (`npm run build && npm start`).
2. Find your computer's local Wi-Fi IP address (for example `192.168.1.45`) or click **Install** on your computer to view detected local Wi-Fi URLs.
3. On your Android tablet, open **Chrome** and visit `http://192.168.1.45:3000`.
4. **Enable Microphone & Install on Plain HTTP**:
   - Open a new Chrome tab and go to: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
   - Paste `http://192.168.1.45:3000` into the text field.
   - Change the dropdown to **Enabled**.
   - Tap **Relaunch** at the bottom of Chrome.
5. Re-open your `http://192.168.1.45:3000` tab, allow microphone access when asked, and tap **⋮ → Install app**.

---

## 3. Recommended Android Tablet Settings (24/7 Stand Mode)

To keep your tablet running smoothly all day and night on a desk or bedside stand:

1. **Landscape / Auto-Rotate**:
   - Swipe down from the top of your Android tablet and turn on **Auto-rotate** (or lock **Landscape**).
   - Horizontal tablets (`1024px+` wide, like `1280×800`) automatically unlock the zero-scroll split dashboard.
   - Portrait tablets (`800×1280`) automatically switch to a clean scrollable layout with Maya on top.
2. **Focus Modes**:
   - Use **Clock & Maya** in the top header when you only want the large clock, date, weather, and Maya's portrait visible.
   - Tap the **Moon** button at night to enable low-brightness **Night Dim**.
3. **Keep Screen Awake**:
   - Maya uses the browser **Screen Wake Lock** while open on screen.
   - For older Android 7/8 tablets where the OS enforces a system screen timeout, go to **Android Settings → Display → Sleep** and select **Never** (or **30 minutes**), or enable **Developer Options → Stay awake while charging**.
4. **Microphone & Spoken Language**:
   - Tap **Talk** or tap Maya's portrait once and tap **Allow** when Chrome asks to use the microphone.
   - Speak naturally in **Slovenian** (`sl-SI`), **English** (`en-US`), **German**, or any supported language — Maya detects your language automatically, or you can lock a preferred language by tapping `Maya · <Your Name>` in the Maya card.

---

## 4. Privacy Verification on Your Tablet

- **Where are my chats stored?** Strictly inside your tablet browser's local storage (`localStorage`).
- **Can I save a copy?** Tap **History** in the Maya card → **Save to Tablet** to download a `.txt` transcript.
- **How do I wipe everything?** Tap `Maya · <Your Name>` → scroll to **Spoken Language & Privacy** → **Erase Local Data**.

---

## 5. Troubleshooting

| Issue | Fix |
| :--- | :--- |
| **Microphone permission blocked on `192.168.x.x`** | Use `https://` or enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure` (Method B step 4). |
| **"Install app" option missing in Chrome** | Reload once after enabling the flag or visit via `https://`. Older tablets show **Add to Home screen**. |
| **No sound when Maya replies** | Tap once anywhere on the screen or tap the speaker icon on a message bubble to unlock Android Web Audio playback, and verify the tablet's Media Volume is turned up. |
| **Layout feels cramped on a small tablet** | Rotate to landscape or switch the top toggle to **Clock & Maya**. |
