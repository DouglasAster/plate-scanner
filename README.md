# Plate Scanner

A phone app that watches for license plates on a list you provide. Point the camera at traffic. When it reads a plate on your list, it sounds an alarm, takes a photo and records a sighting with the time and place. You can add details about each vehicle and the agents seen with it.

Plates that aren't on your list are never saved. Every camera frame is read on the phone and deleted right away unless it contains a match. Nothing is uploaded anywhere.

## Installing and verifying the app

Download the APK from this repository's **Releases** page. Android asks permission to "Install unknown apps" from your browser or file manager the first time.

Before installing, check that the APK is the real one and hasn't been tampered with. Every release is signed with the same key, and this is its certificate fingerprint:

```text
Package:  com.douglasaster.platescanner
SHA-256:  XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

<!-- Maintainers: replace the X's with the fingerprint from step 4 of "Building an APK to share", and post the same fingerprint somewhere outside GitHub too. -->

The same fingerprint is also posted outside GitHub, so an attacker who took over this page would also have to change that copy. If any of them don't match, don't install the app.

**On the phone:** install [AppVerifier](https://github.com/soupslurpr/AppVerifier), share the downloaded APK to it, and paste in the package name and fingerprint above. It tells you whether they match.

**On a computer:** with the Android SDK build tools installed, run:

```bash
apksigner verify --print-certs app-release.apk
```

Compare the `certificate SHA-256 digest` line with the fingerprint above. `apksigner` prints the same digits in lowercase, without colons.

**Checking the download itself:** each release's notes list the SHA-256 checksum of that APK file. It's different for every release. Compare it with:

- Linux: `sha256sum app-release.apk`
- macOS: `shasum -a 256 app-release.apk`
- Windows (PowerShell): `Get-FileHash app-release.apk`

You only need to verify the first install carefully. After that, Android refuses to install an update unless it's signed with the same key.

## Using the app

The app has three tabs: **Scan**, **Vehicles** and **Sightings**.

### 1. Add vehicles to watch for

Open the **Vehicles** tab and type plates into the box, one per line. You can add a note after a comma:

```text
ABC1234, blue sedan
7XYZ890
KJH 552; dented rear bumper
```

Tap **Add**. Spaces, dashes and lowercase letters are ignored, so `abc-1234` and `ABC 1234` are the same plate.

Tap a vehicle to fill in its make, model, color, year, agency and notes, or to fix the plate. Changes save automatically.

For a vehicle with no plate, or one whose plate you couldn't read, tap **+ Add a vehicle without a plate** and describe it instead. The scanner can't match these, since there's no plate to read, but they're kept with their sightings and agents like any other vehicle.

To add many vehicles at once, tap **Import file**. You can pick either:

- a **Plate Scanner file** (`.json`), such as one shared by someone else (see [The plate list file](#the-plate-list-file)), or
- a **text or CSV file** in the same format as the box above. A header row such as `plate,note` is skipped.

A new install starts with the pdxicescan.com registry already loaded; see [The built-in pdxicescan.com registry](#the-built-in-pdxicescancom-registry). Tap **Load built-in list** to merge it in again, for example after updating the app.

Importing never overwrites what you've already entered. For a plate that's already on your list, only blank fields are filled in, and new sightings are added.

Use the search box to find a plate. **Erase all** permanently deletes every vehicle, sighting, agent and photo.

### 2. Scan

Open the **Scan** tab and tap **Start scanning**. The first time, the app asks for camera and location access. Location is only used when a plate matches.

While scanning:

- Hold the phone so plates are clearly visible and roughly level. A dashboard or windshield mount works well.
- The screen stays on.
- The bar at the top shows how many frames have been read and whether there's text in view. It never shows what the text says.
- Scanning stops if you switch to another tab. Tap **Start scanning** again when you come back.

Tap **Stop scanning** when you're done.

**Capturing a vehicle without a plate.** Tap **Capture** to save whatever is in front of the camera as a new vehicle with no plate. It takes a photo and records the location as a sighting, and scanning carries on. Add the make, model, agents and so on later in the **Vehicles** tab. The scanner reads text, so it can't recognize a vehicle by its shape or color, only by its plate.

Temporary paper tags work like any other plate if the number is on your list and the camera can read it. They're often harder to read through a windshield or rear window.

### 3. When a plate matches

The screen flashes red, a car horn honks three times on repeat, and the phone vibrates. The alert shows:

- the plate, the vehicle's description and your notes
- the text the camera read (shown only here, never saved)
- the time and your location
- whether the sighting has been saved

**PLATE MATCH** means the plate was read exactly. **POSSIBLE MATCH — VERIFY** means it matched only after allowing for letters and numbers that cameras often confuse, such as O and 0 or B and 8. Check the photo before acting on a possible match, and delete the sighting if it was wrong.

To dismiss the alert, **press and hold the button for 2 seconds**. A quick tap or the back button won't dismiss it, so it can't be cleared by accident. Scanning then picks up where it left off.

The same plate won't trigger another alert for 3 minutes, so it doesn't keep going off while that car is still in view.

> The horn plays even when the phone is on silent, but apps can't change the volume. Keep your media volume turned up while scanning.

The alarm sound is generated by `node scripts/make-horn.js`. To change the honk length, gaps or pitch, edit the numbers at the top of that script and run it again.

Each match adds a **sighting** to that vehicle with the date, time and coordinates. The photo and the scan frame are added to the vehicle's photos.

### 4. Sightings and agents

The **Sightings** tab lists every sighting, newest first. Tap the coordinates to open the spot in your maps app. Only the coordinates are sent, never the plate.

Tap a sighting to edit it. You can:

- correct the date or time
- type in the address. The app doesn't look addresses up from coordinates, because that would send your location to Apple or Google.
- add the **agents** who were there: name, agency, mask, vest, shirt, coat, pants, shoes, eye color, hair color and skin color. Leave blank anything you didn't see.

To record a sighting you saw without the scanner, open the vehicle and tap **Add sighting**.

On a vehicle's page, press and hold a photo to delete it. **Delete vehicle** removes the vehicle with all of its sightings, agents and photos. **Delete all sightings** on the Sightings tab removes every sighting but keeps the vehicles and photos.

## Tips for better reads

- Plates with 5 or more characters can be found anywhere in a line of text, such as `CALIFORNIA 7ABC123`. Shorter plates must be read as a whole word, which cuts down on false alarms.
- Good light, a steady phone and a clean lens make a big difference.
- Glare, motion blur and plates at a steep angle are the most common reasons a plate gets missed.

## The plate list file

Everything you enter is stored on the phone in one JSON file. Import uses the same format, so a list can be passed from one person to another. Exporting from the app isn't built yet.

```json
{
  "format": "plate-scanner",
  "version": 1,
  "vehicles": [
    {
      "id": "lq2x8k1f9a7d3c2b",
      "plate": "ABC1234",
      "make": "Ford",
      "model": "Explorer",
      "color": "white",
      "year": 2019,
      "agency": "ICE",
      "notes": "tinted windows, no front plate",
      "images": ["media/lq2x8k3a0b1c2d3e.jpg"],
      "videos": [],
      "sightings": [
        {
          "id": "lq2x9m4h2e8f1a0c",
          "date": "2026-10-11",
          "time": "14:55",
          "address": "123 Main St",
          "latitude": 37.77493,
          "longitude": -122.41942,
          "agents": [
            {
              "id": "lq2xa1b2c3d4e5f6",
              "name": "",
              "agency": "ICE",
              "mask": "black neck gaiter",
              "vest": "POLICE ICE",
              "pants": "khaki cargo",
              "shirt": "gray",
              "coat": "",
              "shoes": "black boots",
              "eyeColor": "",
              "hairColor": "brown",
              "skinColor": ""
            }
          ]
        }
      ]
    }
  ]
}
```

- `plate` is stored without spaces or dashes, in capitals. It's `""` for a vehicle with no plate.
- `year`, `latitude` and `longitude` are numbers, or `null` if unknown. Every other field is text; use `""` if unknown.
- `date` is `YYYY-MM-DD` and `time` is 24-hour `HH:MM`, both in local time where the sighting happened.
- `images` and `videos` point to files in the `media/` folder next to the JSON file on the phone. A shared JSON file doesn't include those files yet.
- `id`s let the app recognize the same vehicle or sighting when lists are merged. Vehicles with a plate are matched by plate; vehicles without one are matched by `id`, so give those a stable `id` if the file will be imported more than once. Otherwise you can leave `id`s out and the app will create them.

Imported files are checked before anything is saved. Unknown fields are dropped, values of the wrong type are cleared, and media paths outside `media/` are ignored.

## The built-in pdxicescan.com registry

[pdxicescan.com/vehicle-registry](https://pdxicescan.com/vehicle-registry) lists about 760 reported ICE/DHS vehicles in Oregon and Washington. A copy is kept in this repo at `data/pdxicescan-registry.json` and built into the app:

- A **new install** starts with it loaded.
- **Load built-in list** on the Vehicles tab merges it in at any time. Details already entered are kept; only blank fields are filled in, and new vehicles are added.
- The app never contacts the site. Release builds have no internet access at all.

**What's in it for each vehicle:**

- **Plate**, plus **color, make and model** split out of descriptions like "WA - Black Ford Expedition". Descriptions that list several possible vehicles (plate switchers) are kept whole in the notes.
- **Agency:** "ICE/DHS", or "Possibly non-ICE law enforcement" for vehicles the site flags that way.
- **Notes:** the plate's state, the site's warnings (detention history, possible rental, scout vehicle, removes plates), reported activity and when it was first reported.
- The site's 9 **vehicles without plates** are included, with an empty plate.
- **Photos aren't included yet.** The site has photos for about 500 vehicles.

> **Rental vehicles go stale.** ICE/DHS return rentals every few weeks, so a match on a vehicle noted as a possible rental may be an ordinary rental car now. Check the notes before acting on a match.

### Updating the built-in copy

The site has no download or API; its data is built into the page's JavaScript. `scripts/import-pdxicescan.js` downloads that code, reads it as text (it never runs the site's code) and rewrites `data/pdxicescan-registry.json`:

```bash
node scripts/import-pdxicescan.js
```

It prints what it found, for example:

```text
Registry tables found (description: 1, notes: 2, firstSeen: 1, flag: 3, photos: 1); warnings found: detentionAlert, rentalCaution, nonIceLea, scoutAlert, obscuredPlate
Wrote 762 vehicles to data/pdxicescan-registry.json
Includes 9 vehicles without a plate (NP-001, ...)
```

If any of those counts drop to zero, or the script stops with "The site may have changed", the site's code has changed and the script needs updating. Don't commit a file from a run like that; `git diff data/` shows exactly what changed.

The new copy reaches phones with the next app build: rebuild and reinstall, then tap **Load built-in list**. During development, reloading the app is enough.

You can also pass a path to write somewhere else, such as `node scripts/import-pdxicescan.js /tmp/registry.json`, and import that file on the phone with **Import file**.

The registry is the work of the people who run pdxicescan.com. Consider asking them for permission to redistribute it and for an official export, which would be more reliable than reading it out of their code.

## Building the app

You need a physical phone, because the app uses the camera. Text recognition uses ML Kit on Android and Apple's Vision framework on iOS, so the app won't run in Expo Go. You build your own copy of the app instead, either on your computer or in the cloud.

### 1. Install JavaScript dependencies

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install --legacy-peer-deps
```

> **Why `--legacy-peer-deps`?** A plain `npm install` currently fails because npm tries to pull in an optional web package that needs a newer React than Expo SDK 57 supports. This flag skips that check.

### 2a. Android setup (Linux or macOS)

You need Java 17 and the Android SDK. On Windows, follow [Expo's setup guide](https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build&buildEnv=local) instead.

1. **Install JDK 17.** Expo builds expect version 17, so a newer JDK may fail.
   - Ubuntu/Debian: `sudo apt update && sudo apt install openjdk-17-jdk`. Running `apt update` first avoids `404 Not Found` errors from an out-of-date package list.
   - macOS: `brew install --cask zulu@17`

   If more than one Java is installed, point `JAVA_HOME` at 17. On Ubuntu that's:

   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   ```

2. **Set where the SDK will go.** Add these lines to `~/.bashrc`, or `~/.zshrc` if you use zsh. They're the default locations Expo looks in:

   ```bash
   # Linux
   export ANDROID_HOME=$HOME/Android/Sdk
   # macOS: export ANDROID_HOME=$HOME/Library/Android/sdk

   export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin
   ```

   Then open a new terminal, or run `source ~/.bashrc`.

3. **Install the Android SDK.** Android Studio isn't needed; building only needs the SDK, which installs from the command line. Download Google's command-line tools for your system:

   ```bash
   # Linux (needs unzip: sudo apt install unzip)
   curl -Lo /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip
   # macOS, Apple silicon:
   #   curl -Lo /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip
   # macOS, Intel:
   #   curl -Lo /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-mac_x86_64-15859902_latest.zip
   ```

   Then unpack them and install the SDK parts the app needs:

   ```bash
   mkdir -p "$ANDROID_HOME/cmdline-tools"
   unzip -q /tmp/cmdline-tools.zip -d "$ANDROID_HOME/cmdline-tools"
   mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
   rm /tmp/cmdline-tools.zip

   yes | sdkmanager --licenses
   sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"
   ```

   These versions are the ones React Native 0.86 builds against. Check that `adb --version` works.

   If a download link stops working, get the current one from "Command line tools only" at the bottom of [Google's download page](https://developer.android.com/studio#command-line-tools-only).

4. **Connect your phone.**
   1. On the phone, go to **Settings → About phone** and tap **Build number** seven times to turn on developer options.
   2. Turn on **Settings → Developer options → USB debugging**.
   3. Plug the phone in over USB and accept the prompt to allow debugging.
   4. Run `adb devices`. Your phone should be listed with `device` next to it.

   On Linux, if it shows `no permissions` or `unauthorized`, install the udev rules (`sudo apt install android-sdk-platform-tools-common`), add yourself to the `plugdev` group, log out and back in, and reconnect the phone.

5. **Build and run:**

   ```bash
   npx expo run:android
   ```

### 2b. iOS setup (macOS only)

1. Install **Xcode** from the Mac App Store and open it once to finish installing its components. Then run `xcode-select --install` to install the command line tools.
2. Install CocoaPods: `brew install cocoapods`
3. You need an Apple Developer Program membership to install the app on your own iPhone. Sign in to Xcode under **Settings → Accounts**.
4. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode**. The phone will restart.
5. Plug in the iPhone and run:

   ```bash
   npx expo run:ios --device
   ```

   Pick your phone from the list. The first build installs the iOS dependencies (CocoaPods) automatically, which takes a few minutes.

### What the build does

`npx expo run:android` and `npx expo run:ios` generate the `android/` and `ios/` folders, build the app, install it on your phone and start the dev server. Those folders are generated from `app.json` and `plugins/`, so don't edit them by hand. They're gitignored.

After the first build, start the dev server on its own with `npx expo start` and open the app on your phone. You only need to rebuild after adding a package with native code or changing `app.json`, `plugins/`, `modules/` or the icons. Run `npx expo prebuild --clean` first in those cases, so the `android/` and `ios/` folders are regenerated; `run:android` and `run:ios` don't refresh a folder that already exists.

Development builds keep internet access so they can load code from your computer. Release builds on Android have it removed.

### Building in the cloud instead

If you don't want to install the Android SDK or Xcode, use EAS, which builds the app on Expo's servers. You need a free [Expo account](https://expo.dev/signup).

```bash
npx eas-cli@latest build --profile development --platform android   # or --platform ios
```

The first run walks you through setup. When the build finishes, scan the QR code or open the link on your phone to install the app, then run `npx expo start`.

### Building an APK to share

You can build an APK file that people install directly ("sideload") without an app store. Release builds have no internet access on Android, so the file you share can't send anything off the phone.

**1. Create a signing key (once).** Android only installs an update over an existing copy if both are signed with the same key, so you'll use this key for every release. `keytool` comes with the JDK:

```bash
mkdir -p ~/.android-keys
keytool -genkeypair -v -storetype PKCS12 -keyalg RSA -keysize 4096 -validity 10000 \
  -keystore ~/.android-keys/plate-scanner.keystore -alias plate-scanner
```

It asks for a password and a name. The name is shown to anyone who inspects the certificate, so you don't have to use your real one.

> **Back up the keystore file and its password somewhere safe and private.** If you lose either one, you can never release an update that installs over existing copies. If someone else gets them, they can sign fake updates that phones will accept. Never commit the keystore to git.

**2. Tell the build where the key is.** Add these lines to `~/.gradle/gradle.properties`, creating the file if needed. They live outside the project so the password never ends up in git:

```properties
PLATE_SCANNER_STORE_FILE=/home/YOU/.android-keys/plate-scanner.keystore
PLATE_SCANNER_STORE_PASSWORD=your-password
PLATE_SCANNER_KEY_ALIAS=plate-scanner
PLATE_SCANNER_KEY_PASSWORD=your-password
```

Use the full path to the keystore; `~` doesn't work here. The two passwords are the same for this kind of keystore. Make the file readable only by you: `chmod 600 ~/.gradle/gradle.properties`.

**3. Build the APK.**

```bash
npx expo prebuild --clean --platform android
cd android && ./gradlew assembleRelease && cd ..
```

The APK is at `android/app/build/outputs/apk/release/app-release.apk`.

If the build prints `PLATE_SCANNER_STORE_FILE is not set`, it couldn't find your key and signed the app with the shared debug key instead. Don't share that APK.

**4. Check it before sharing.**

```bash
APK=android/app/build/outputs/apk/release/app-release.apk
BT=$ANDROID_HOME/build-tools/36.0.0

$BT/apksigner verify --print-certs $APK   # should show your name, not "Android Debug"
$BT/aapt2 dump permissions $APK           # should NOT list android.permission.INTERNET
sha256sum $APK                            # publish this alongside the file
```

Publish both values so people can check they got your file and not a tampered copy (see [Installing and verifying the app](#installing-and-verifying-the-app)):

- **The certificate's SHA-256 digest** stays the same for every release signed with your key. Put it in the README section above in `AB:CD:...` form: uppercase, in pairs separated by colons. Also post it somewhere outside GitHub, such as a website or a pinned social media post. Someone who took over the GitHub account could change the README, but not that copy as well.
- **The APK's SHA-256 checksum** is different for each release. Put it in that release's notes on GitHub.

To convert `apksigner`'s output to the colon form:

```bash
$BT/apksigner verify --print-certs $APK | grep 'certificate SHA-256 digest' | awk '{print toupper($NF)}' | sed 's/../&:/g; s/:$//'
```

**5. Release updates.** Before each new release, raise `android.versionCode` in `app.json` by 1 and update `version` (for example `1.0.0` → `1.0.1`). Then repeat steps 3 and 4. Android refuses to install an update whose `versionCode` isn't higher than the installed one.

**Installing it.** On the phone, open the APK from a browser or file manager. Android asks permission to "Install unknown apps" from that app the first time. Google Play Protect may warn that it doesn't recognize the app; tap **More details → Install anyway**.

### Icons

The app icon images in `assets/` are generated by `python3 scripts/make-icons.py` (needs Pillow: `pip install pillow`). Edit the colors and shapes at the top of the script and run it again. Icon changes only show up after regenerating the native project and rebuilding: `npx expo prebuild --clean --platform android`, then `npx expo run:android`. `run:android` on its own reuses the existing `android/` folder and its old icons.

The tab icons come from `expo-symbols`: SF Symbols on iOS and Material Symbols on Android. They're set in `src/app/(tabs)/_layout.tsx`.

### Before submitting changes

```bash
npx expo lint
npx tsc --noEmit
npx expo-doctor
```

## Privacy

The app is built to keep as little as possible about you or the cars it sees, and to keep what it does store on your phone.

**Plates that don't match**

- Each camera frame is read on the phone and deleted as soon as it has been checked. Any frame left behind by a crash is cleared the next time the app opens.
- The text that was read is never saved, logged or shown on screen.
- Only matches are stored, as sightings.

**Your data**

- Everything is stored in one file on the phone: your vehicle list with its sightings and agents, plus the photos. See [The plate list file](#the-plate-list-file).
- Location is read only at the moment of a match, and only while the app is open. The app never asks for background location.
- Addresses are never looked up automatically, so your location isn't sent to a map service.
- Deleting something rewrites the file without it, and deleting a vehicle or photo deletes the photo files too.
- **Erase all** on the Vehicles tab deletes everything at once.

**Keeping data on the phone**

- The app has no account, server or analytics.
- Android release builds have no internet permission at all, so the app can't send anything. Text recognition runs inside the app rather than through Google Play services.
- On iOS, text recognition uses Apple's on-device Vision framework.
- App data is excluded from iCloud backups, Android cloud backups and Android phone-to-phone transfers. Your list won't follow you to a new phone.
- On iOS, the app's files are encrypted and can't be read while the phone is locked.

**On screen**

- Screenshots and screen recording are blocked inside the app.
- The app's contents are hidden in the app switcher.

**What it can't prevent**

- A match photo shows whatever else was in view, including other cars.
- Anyone who can unlock your phone and open the app can see your vehicles, sightings and agents.
- Opening a sighting's location sends those coordinates to your maps app.
- A plate list you share shows everything in it, including sighting times and places, which reveal where whoever recorded them was. Check what's in a file before sharing it.

## License

Plate Scanner is released under a modified [Anti-Capitalist Software License](https://anticapitalist.software/) (v1.4). It may be used by individuals, non-profits, non-government schools and universities, and worker-owned cooperatives. It may **not** be used by corporations, governments, law enforcement or the military, or by anyone working for or on behalf of them. See [LICENSE](LICENSE) for the full terms.

## Roadmap

- add plate list
- capture cars with no plates
- spanish
- ukrainian
- russian
- app logo
- nav buttons
- capture mode that adds, eg. every car coming out of an ice building
- put on github
- make website
