const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './build/icon', // Packager handles extension automatically (.exe / .app)
    extraResource: [
      './electron/templates'
    ],
    ignore: [
      /^\/src/,
      /^\/website/,
      /^\/\.git/,
      /^\/\.github/,
      /^\/dist-installer/,
      /^\/dist-packager/
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: './build/icon.ico',
        iconUrl: 'https://raw.githubusercontent.com/CyberWasDreaming0/folderforge/main/build/icon.ico',
        loadingGif: './build/icon_loading_GIF.gif',
        authors: 'CyberWasDreaming',
        description: 'A beautiful desktop app for creating and managing reusable folder structures instantly.'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32', 'darwin', 'linux'], // Enable for Windows to get the "portable" zip!
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
