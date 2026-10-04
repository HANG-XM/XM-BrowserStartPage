/**
 * zh-CN.js —— 简体中文语言包
 *
 * 纯对象结构；新增文案时请与 en-US.js 保持键位一致。
 * date.template 支持的占位符见 i18n/index.js 的 formatDate()。
 */
export default {
  meta: {
    name: '简体中文',
  },
  page: {
    title: 'XM 起始页',
  },
  greeting: {
    dawn: '凌晨好',       // 0-5 点
    morning: '早上好',    // 5-12 点
    afternoon: '下午好',  // 12-18 点
    evening: '晚上好',    // 18-24 点
  },
  theme: {
    light: '亮色主题',
    dark: '暗色主题',
    system: '跟随系统',
    toggle: '切换主题',
  },
  search: {
    placeholder: '在 {engine} 中搜索',
    inputLabel: '搜索框，当前引擎：{engine}',
    engineMenu: '切换搜索引擎，当前：{engine}',
    engines: {
      google: 'Google',
      bing: '必应',
      yandex: 'Yandex',
      baidu: '百度',
    },
  },
  wallpaper: {
    title: '壁纸',
    solid: '纯色',
    gradient: '渐变',
    local: '本地图片',
    customColor: '自定义颜色',
    overlay: '遮罩透明度',
    blur: '背景模糊',
    chooseFile: '选择图片',
    apply: '应用',
    remove: '移除壁纸',
    tooLarge: '图片超过 5MB，可能影响加载速度',
    loadError: '图片加载失败，已回退到默认背景',
    indexedDBUnavailable: '当前环境不支持本地图片（IndexedDB 不可用）',
  },
  settings: {
    title: '设置',
    open: '打开设置',
    close: '关闭设置',
    section: {
      appearance: '外观',
      search: '搜索',
      language: '语言',
      data: '数据',
      about: '关于',
    },
    theme: {
      light: '亮色',
      dark: '暗色',
      system: '跟随系统',
    },
    searchOpacity: '搜索框透明度',
    engine: '默认搜索引擎',
    language: {
      zh: '简体中文',
      en: 'English',
    },
    reset: '重置为默认',
    resetConfirm: '将清空所有本地配置并刷新页面，确定吗？',
    data: {
      import: '导入配置',
      export: '导出配置',
    },
    about: {
      version: '版本',
      privacy: '所有数据仅保存在本地浏览器，不上传、不同步。',
    },
  },
  backup: {
    exportSuccess: '导出成功',
    exportFailed: '导出失败，请重试',
    importConfirm: '导入会覆盖当前所有配置，是否继续？',
    importSuccess: '导入成功，即将刷新页面',
    importFailed: '导入失败，已恢复原配置',
    importInvalidJson: '文件不是有效的 JSON',
    importTooLarge: '文件超过 5MB',
    importVersionWarning: '配置来自更高版本，可能不兼容',
    wallpaperDiscarded: '本地图片壁纸未随配置导入，已回退为纯色',
    fileInputLabel: '选择配置文件',
  },
  date: {
    // 索引与 Date.getDay() 对应：0 = 周日
    weekdays: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    template: '{year}年{month}月{day}日 {weekday}',
  },
};
