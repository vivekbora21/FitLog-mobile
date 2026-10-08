const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @fitlog/shared is vendored locally at src/shared (copied from packages/shared) so
// that EAS cloud builds — which only have access to this repo, not sibling repos —
// can resolve it. Do not point this back at ../packages/shared.
config.resolver.extraNodeModules = {
  '@fitlog/shared': path.resolve(__dirname, 'src/shared'),
};

// Enable wasm assets for expo-sqlite
config.resolver.assetExts.push('wasm');

module.exports = config;
