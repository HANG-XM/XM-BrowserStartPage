/**
 * en-US.js —— English (US) language pack
 *
 * 纯对象结构；键位与 zh-CN.js 保持一致。
 * date.template 支持的占位符见 i18n/index.js 的 formatDate()。
 */
export default {
  meta: {
    name: 'English',
  },
  page: {
    title: 'XM Start Page',
  },
  greeting: {
    // One candidate pool per period: the first item is the clock anchor (it tells the time and
    // can never be contradicted by what's outside the window); the rest are quiet statements.
    // Pool length is the modulo base — adding or removing an item changes what every user sees today.
    dawn: [
      "The night's not over",  // 0-5
      'The small hours',
      'The quietest stretch',
      "Sleep hasn't come",
      'Nothing but screen light',
      'Not a sound outside',
      'Time moves slowly here',
      'The occasional car goes by',
    ],
    morning: [
      "Morning's here",        // 5-11
      "Light's coming in",
      'Birds are up',
      "The air's still cool",
      'The room is getting brighter',
      'More sounds are coming in',
      'There are cars on the street',
      'Waking up slowly',
    ],
    noon: [
      "It's noon",             // 11-13
      'The light comes straight down',
      'Shadows at their shortest',
      "It's that time of day",
      'Halfway through',
      'Noon goes by fastest',
      'A good hour to stare at nothing',
      'Nobody feels like moving',
    ],
    afternoon: [
      "It's afternoon",        // 13-18
      "The light's going sideways",
      'The sleepiest hours of the day',
      'Afternoons always run slow',
      "It's quiet outside",
      'Still a long afternoon',
      'The sun has moved to the desk',
      'The hours are hard to fill',
    ],
    evening: [
      "It's evening",          // 18-24
      'The lights are all on',
      "It's dark out",
      "The street's gone quiet",
      "That's it for today",
      "The night's just starting",
      'People are coming home',
      'The loosest hour of the day',
    ],
  },
  theme: {
    light: 'Light theme',
    dark: 'Dark theme',
    system: 'Follow system',
    toggle: 'Toggle theme',
  },
  search: {
    placeholder: 'Search on {engine}',
    inputLabel: 'Search input, current engine: {engine}',
    engineMenu: 'Switch search engine, current: {engine}',
    engines: {
      google: 'Google',
      bing: 'Bing',
      yandex: 'Yandex',
      baidu: 'Baidu',
    },
  },
  wallpaper: {
    title: 'Wallpaper',
    solid: 'Solid',
    gradient: 'Gradient',
    local: 'Local image',
    customColor: 'Custom color',
    overlay: 'Overlay opacity',
    blur: 'Background blur',
    chooseFile: 'Choose image',
    apply: 'Apply',
    remove: 'Remove wallpaper',
    tooLarge: 'Image exceeds 5MB and may load slowly',
    loadError: 'Failed to load image, reverted to default background',
    indexedDBUnavailable: 'Local images unavailable (IndexedDB not supported)',
  },
  settings: {
    title: 'Settings',
    open: 'Open settings',
    close: 'Close settings',
    section: {
      appearance: 'Appearance',
      search: 'Search',
      language: 'Language',
      data: 'Data',
      about: 'About',
    },
    theme: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    searchOpacity: 'Search box opacity',
    engine: 'Default search engine',
    language: {
      zh: '简体中文',
      en: 'English',
    },
    reset: 'Reset to defaults',
    resetConfirm: 'This clears all local data and reloads the page. Continue?',
    data: {
      import: 'Import config',
      export: 'Export config',
    },
    about: {
      version: 'Version',
      privacy: 'All data stays in your browser. Nothing is uploaded or synced.',
    },
  },
  backup: {
    exportSuccess: 'Export successful',
    exportFailed: 'Export failed, please try again',
    importConfirm: 'Importing will overwrite all current settings. Continue?',
    importSuccess: 'Import successful, reloading',
    importFailed: 'Import failed, settings restored',
    importInvalidJson: 'File is not valid JSON',
    importTooLarge: 'File exceeds 5MB',
    importVersionWarning: 'Config is from a newer version and may be incompatible',
    wallpaperDiscarded: 'Local image wallpaper was not imported and has been reset to solid color',
    fileInputLabel: 'Choose config file',
  },
  date: {
    // 索引与 Date.getDay() 对应：0 = Sunday
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    // 索引与 Date.getMonth() 对应：0 = January
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    template: '{weekday}, {monthName} {day}, {year}',
  },
};
