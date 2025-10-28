# IndiaRentalApp

Here you go—clean, copy-pasteable, and **simple**. It assumes you’re running an **Expo + React Native** app and using the **default maps setup** (e.g., `react-native-maps` / Google Maps on Android, Apple Maps on iOS, and a basic web map if needed). No MapLibre instructions included.

---

# IndiaRentalApp — Local Setup (Simple)

A React Native (Expo) app for room & rental listings with map and search.

## Prerequisites

* **Node.js** 18+ (LTS recommended)
* **npm** (or yarn/pnpm) – examples use `npm`
* **Expo CLI**

  ```bash
  npm i -g expo
  ```
* To run on simulators/devices:

  * **iOS (macOS only):** Xcode + Command Line Tools
  * **Android:** Android Studio + one AVD emulator

> Tip: Install the **Expo Go** app on your phone to run the app on a real device via QR code.

---

## Clone & Install

```bash
git clone https://github.com/sridattagrandhi/IndiaRentalApp.git
cd IndiaRentalApp
npm install
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Maps (public client key if you use Google services in the app)
EXPO_PUBLIC_MAPS_API_KEY=your_maps_key_here
```

> Expo only exposes vars that start with `EXPO_PUBLIC_`.
> If you aren’t using any key yet, you can leave this as a placeholder.

---

## Run the App

Start the dev server:

```bash
npm run start
# or
expo start
```

Open on a target:

* **iOS Simulator (macOS):** press `i` in the Expo terminal, or run:

  ```bash
  npm run ios
  # or
  expo run:ios   # if you’ve prebuilt native projects
  ```

* **Android Emulator:** press `a` in the Expo terminal, or run:

  ```bash
  npm run android
  # or
  expo run:android
  ```

* **Physical device:** scan the QR code with **Expo Go**.

* **Web (optional):**

  ```bash
  npm run web
  # or
  expo start --web
  ```

---

## Scripts (package.json)

If not present, these are the typical ones:

```jsonc
{
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "android": "expo run:android",
    "web": "expo start --web",
    "lint": "eslint . --ext .ts,.tsx"
  }
}
```

---

## Notes on Maps (Simple Setup)

* **iOS:** Uses Apple Maps by default (no extra key needed for basic map display).
* **Android:** Uses Google Maps via `react-native-maps`. For advanced features, you may add a Google Maps API key later—store it as `EXPO_PUBLIC_MAPS_API_KEY` and wire it where needed in code.
* **Web:** If you render a web map, you may need to include the Google Maps JS API or another web map provider (optional for now).

---

## Troubleshooting

* **Dev server/env vars not picked up:** stop the server and run `expo start -c` to clear cache.
* **Android emulator not launching:** open Android Studio → Device Manager → start an AVD, then `npm run android`.
* **iOS build issues (only if you prebuild):**

  ```bash
  npx expo prebuild
  cd ios && pod install && cd ..
  npx expo run:ios
  ```
* **Network requests failing on device:** ensure phone and computer are on the same Wi-Fi; try “Tunnel” connection in the Expo Dev Tools.

That’s it. If you later switch mapping providers or add keys, just update the `.env` and the map config in code—no other setup changes needed.
