# Standalone Android Tablet Setup Guide (No Computer Required)

This guide explains how to install and run **Maya Companion** completely **by itself** on any **Android tablet** (Samsung Galaxy Tab, Huawei MediaPad T3/T5, Lenovo Tab, Xiaomi Pad, or older Android 7+ tablets) with **zero computer connection**.

---

## 1. What You Need

- An Android tablet with **Google Chrome** (or Microsoft Edge)
- A link to your deployed **Maya Companion** HTTPS web address
- Internet access once to install (after installation, offline features run right on the tablet even without internet!)

> **No Google Play Store & No USB Cable Needed**: Maya installs straight from Chrome onto your home screen as an independent full-screen app, which also works smoothly on Huawei tablets and older Android models.

---

## 2. Install Maya Directly on the Tablet (4 Steps)

Do everything right on the tablet screen — you do **not** need a laptop, PC, or cable:

1. **Open Chrome on the Tablet**
   Launch **Google Chrome** and open your **Maya Companion HTTPS URL**.
2. **Tap Install**
   Tap the **Install** button in the top-right bar of Maya — **or** tap Chrome's **⋮ menu** (top-right corner) and select **Install app** (on older Chrome versions: **Add to Home screen**).
3. **Confirm Installation**
   Tap **Install** on the popup. Android creates a dedicated **Maya** app icon on your home screen.
4. **Launch Maya Standalone**
   Close Chrome and tap the new **Maya** icon on your tablet home screen. Maya opens in full-screen standalone mode without any browser address bar and runs completely by itself.

---

## 3. First Launch Permissions

1. Tap **Talk** (or tap Maya's smiling portrait) and tap **Allow** when Android asks for **Microphone** access.
2. When prompted for **Location**, tap **Allow** if you want automatic local city detection and live weather (only rounded ~1 km coordinates are used, stored strictly on the tablet).

---

## 4. What Works Online vs. Offline by Itself

Once installed on your tablet:

| Feature | Works Offline (No Internet) | Works Online (Tablet Wi-Fi / 4G) |
| :--- | :---: | :---: |
| **Live Clock, Date & Standby Mode** | Yes | Yes |
| **Tasks & Daily Schedule (Local Storage)** | Yes | Yes |
| **Daily Wishes & Focus Timer (Pomodoro)** | Yes | Yes |
| **Quick Voice Commands (Time, Date, Tasks, Weather Cache)** | Yes | Yes |
| **Natural Multilingual Voice Conversation & News** | — | Yes |
| **Live Weather Refresh** | Cached forecast | Live forecast |

---

## 5. Recommended 24/7 Tablet Stand Settings

1. **Orientation**:
   - **Landscape (Horizontal, 1024px+ wide / `1280×800`)**: Zero-scroll split view with Clock/Planner + Maya side-by-side.
   - **Portrait (Vertical, `800×1280`)**: Clean scrollable layout with Maya on top and Clock/Planner below.
2. **Keep Display Awake**:
   - Maya automatically enables **Screen Wake Lock** while visible on screen.
   - On older Android 7/8 tablets where the system enforces a display timeout, open **Android Settings → Display → Sleep → Never** (or **30 minutes**).
3. **Bedside Night Mode**:
   - Switch the top toggle to **Clock & Maya** to hide tasks and show only the large clock, date, weather, and Maya.
   - Tap the **Moon** button to lower screen brightness with **Night Dim**.
4. **Spoken Language**:
   - Speak naturally in **Slovenian** (`sl-SI`), **English** (`en-US`), **German**, or other supported languages — or tap `Maya · <Your Name>` to lock a preferred language.

---

## 6. Device Privacy Controls

- **Local-First Storage**: Your name, tasks, schedule, and conversation history remain inside your tablet's own storage (`localStorage`), never in an external user database.
- **Export History**: Tap **History → Save to Tablet** to save a `.txt` transcript straight to your tablet's Downloads folder.
- **One-Tap Erase**: Tap `Maya · <Your Name>` → **Erase Local Data** to wipe all locally saved data immediately.

---

## 7. Troubleshooting on Android Tablets

| Issue | Fix |
| :--- | :--- |
| **"Install app" option doesn't appear** | Make sure the URL starts with `https://`, reload once in Google Chrome, and check Chrome **⋮ → Add to Home screen**. |
| **No sound when Maya replies** | Tap once anywhere on the screen or tap the speaker icon on a message bubble to unlock Android audio playback, and turn up **Media Volume**. |
| **Microphone says blocked** | Tap the padlock / site settings icon next to Chrome's address bar → **Permissions → Microphone → Allow** (or **Android Settings → Apps → Chrome → Permissions → Microphone**). |
| **Screen still dims on older Android 7/8** | Set **Android Settings → Display → Sleep → Never** (or **Stay awake while charging** under Developer Options). |
