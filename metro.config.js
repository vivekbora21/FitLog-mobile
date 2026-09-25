const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Shared types/utilities live inside the app so EAS Build uploads them
config.resolver.extraNodeModules = {
  '@fitlog/shared': path.resolve(__dirname, 'src/shared'),
};

// Enable wasm assets for expo-sqlite
config.resolver.assetExts.push('wasm');

module.exports = config;
