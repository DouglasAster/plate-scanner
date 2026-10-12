// Native privacy hardening for Android. iOS settings live in app.json
// (data protection entitlement) and modules/backup-exclusion.
const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAppBuildGradle,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');

const MARKER = '// plate-scanner: bundled ML Kit text recognition';

// Android 12+ ignores allowBackup="false" for device-to-device transfers, so every
// storage domain is excluded explicitly from both cloud backup and device transfer.
const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];
const excludeAll = DOMAINS.map((d) => `    <exclude domain="${d}" path="." />`).join('\n');
const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludeAll}
  </cloud-backup>
  <device-transfer>
${excludeAll}
  </device-transfer>
</data-extraction-rules>
`;

// Release builds get no network access at all. Debug builds keep it so the
// dev client can reach the Metro bundler.
const RELEASE_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
  <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" tools:node="remove" />
</manifest>
`;

// expo-text-extractor depends on the Play services ML Kit, which downloads its model
// into Google Play services and runs text recognition there. Adding the bundled
// library ships the model inside this app, and ML Kit then runs it in-process,
// where release builds have no network access.
const MLKIT_BUNDLED = `
${MARKER}
dependencies {
    implementation("com.google.mlkit:text-recognition:16.0.1")
}
`;

function withNoBackup(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:allowBackup'] = 'false';
    app.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
    delete app.$['android:fullBackupContent'];
    return cfg;
  });
}

function withNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const appDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src');
      const xmlDir = path.join(appDir, 'main', 'res', 'xml');
      const releaseDir = path.join(appDir, 'release');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(releaseDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'data_extraction_rules.xml'), DATA_EXTRACTION_RULES);
      fs.writeFileSync(path.join(releaseDir, 'AndroidManifest.xml'), RELEASE_MANIFEST);
      return cfg;
    },
  ]);
}

function withBundledTextRecognition(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += MLKIT_BUNDLED;
    }
    return cfg;
  });
}

module.exports = function withPrivacy(config) {
  return withBundledTextRecognition(withNativeFiles(withNoBackup(config)));
};
