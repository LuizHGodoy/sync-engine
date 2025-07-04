const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.join(workspaceRoot, "packages")];

config.resolver.extraNodeModules = {
  "sync-engine-lib": path.join(workspaceRoot, "packages", "sync-engine-lib"),
};

module.exports = config;
