const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package directory outside of mobile/
config.watchFolders = [
  path.resolve(workspaceRoot, 'packages/shared'),
];

// Resolve @fitlog/shared directly to packages/shared/src
config.resolver.extraNodeModules = {
  '@fitlog/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
};

// Enable wasm assets for expo-sqlite
config.resolver.assetExts.push('wasm');

module.exports = config;
