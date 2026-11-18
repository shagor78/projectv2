# Platform Compatibility Guide

This document describes what VeloStream supports today in browser environments versus which native store targets require platform-specific wrappers or external SDK builds.

---

## 1. Verified Browser & Responsive Support (Implemented)

| Platform / Form Factor | Support Level | Technical Details |
| :--- | :--- | :--- |
| **Desktop Web** (Chrome, Edge, Firefox, Safari) | **Supported** | Responsive dark OTT layout, 5-column desktop poster grids for Movies/Drama/Web Series, `hls.js` MSE adaptive bitrate playback, native Safari HLS fallback, keyboard `ArrowLeft`/`ArrowRight`/`Enter`/`Space`/`Escape` navigation. |
| **Mobile & Tablet Web** (Android Chrome, iOS Safari) | **Supported** | Responsive single-column / compact grids, touch-friendly controls, mobile navigation drawer, inline HLS playback (`playsInline`). |
| **Smart TV / Console Browser Mode** | **Partial (Web Only)** | Full-screen dark 10-foot UI with `Arrow`/`Enter`/`Escape` keyboard/D-pad event bindings in `HlsPlayer.tsx` and TV-safe contrast. |

---

## 2. Native Store Binaries & Proprietary TV SDKs (Blocked / Out of Web Repo Scope)

A single web codebase does not automatically produce signed native app store binaries. Building dedicated native wrappers requires external platform toolchains and signing keys:

| Target Platform | Status | Requirement to Ship |
| :--- | :--- | :--- |
| **Android Mobile & Android TV (APK/AAB)** | **BLOCKED (External SDK)** | Requires Capacitor/React Native or Kotlin Compose TV wrapper + Android SDK & Play Store signing keystore. |
| **iOS & tvOS (IPA)** | **BLOCKED (External SDK)** | Requires macOS Xcode, Apple Developer certificates, and Swift/Capacitor wrapper. |
| **Samsung Tizen TV (.wgt)** | **BLOCKED (External SDK)** | Requires Tizen Studio SDK + Samsung TV certificate & AVPlay integration if DRM/HEVC hardware pass-through is needed. |
| **LG webOS TV (.ipk)** | **BLOCKED (External SDK)** | Requires LG webOS TV CLI (`ares-package`) + LG Seller Lounge signing. |
| **Windows / Linux Desktop Installers** | **BLOCKED (External SDK)** | Requires Electron or Tauri packaging pipeline to emit `.exe`/`.msi`/`.AppImage`/`.deb`. |
