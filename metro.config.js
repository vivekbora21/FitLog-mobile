const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve the shared runtime package directly. Pointing this alias at mobile/src/shared
// creates a self-re-export cycle because that folder also re-exports @fitlog/shared.
const sharedPackageRoot = path.resolve(__dirname, '../packages/shared');
config.watchFolders = [...(config.watchFolders || []), sharedPackageRoot];
config.resolver.extraNodeModules = {
  '@fitlog/shared': path.resolve(sharedPackageRoot, 'src'),
};

// Enable wasm assets for expo-sqlite
config.resolver.assetExts.push('wasm');

module.exports = config;
