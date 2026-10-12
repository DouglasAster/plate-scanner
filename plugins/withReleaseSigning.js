// Signs Android release builds with your own key instead of the shared debug key.
// The key and its passwords stay outside the repo, in ~/.gradle/gradle.properties:
//
//   PLATE_SCANNER_STORE_FILE=/absolute/path/to/plate-scanner.keystore
//   PLATE_SCANNER_STORE_PASSWORD=...
//   PLATE_SCANNER_KEY_ALIAS=plate-scanner
//   PLATE_SCANNER_KEY_PASSWORD=...
//
// Without them, release builds fall back to the debug key and print a warning.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// plate-scanner: release signing';

const SIGNING_CONFIG = `signingConfigs {
        ${MARKER}
        release {
            if (project.hasProperty('PLATE_SCANNER_STORE_FILE')) {
                storeFile file(PLATE_SCANNER_STORE_FILE)
                storePassword PLATE_SCANNER_STORE_PASSWORD
                keyAlias PLATE_SCANNER_KEY_ALIAS
                keyPassword PLATE_SCANNER_KEY_PASSWORD
            }
        }`;

const RELEASE_DEBUG_SIGNING = /(release \{\s*(?:\/\/[^\n]*\n\s*)*)signingConfig signingConfigs\.debug/;

const RELEASE_SIGNING = `$1if (project.hasProperty('PLATE_SCANNER_STORE_FILE')) {
                signingConfig signingConfigs.release
            } else {
                logger.warn('WARNING: PLATE_SCANNER_STORE_FILE is not set; signing the release build with the debug key. Do not share this APK.')
                signingConfig signingConfigs.debug
            }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;
    if (!src.includes('signingConfigs {') || !RELEASE_DEBUG_SIGNING.test(src)) {
      throw new Error('withReleaseSigning: android/app/build.gradle has an unexpected layout; update the plugin.');
    }
    src = src.replace('signingConfigs {', SIGNING_CONFIG);
    src = src.replace(RELEASE_DEBUG_SIGNING, RELEASE_SIGNING);
    cfg.modResults.contents = src;
    return cfg;
  });
};
