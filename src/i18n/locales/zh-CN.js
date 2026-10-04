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
    // 每时段一个候选池：第 1 项为「钟点锚点」（承担报时功能，不可被窗外景况证伪），
    // 其余为轻陈述句。池长度即取模基数，增删任一条都会改变当天所有用户看到的句子。
    dawn: [
      '凌晨了',           // 0-5 点
      '夜还很深',
      '这会儿最安静',
      '睡意还没来',
      '只有屏幕还亮着',
      '窗外一点声音都没有',
      '时间过得很慢',
      '偶尔有车从楼下过去',
    ],
    morning: [
      '早上了',           // 5-11 点
      '光进来了',
      '外面有鸟叫',
      '空气是凉的',
      '屋里的光慢慢变亮',
      '外面的声音多起来了',
      '街上有车了',
      '慢慢醒过来',
    ],
    noon: [
      '中午了',           // 11-13 点
      '光直直落下来',
      '影子缩到最短',
      '到饭点了',
      '一天走到一半',
      '中午的时间过得最快',
      '这会儿最适合发一会儿呆',
      '谁都不太想动',
    ],
    afternoon: [
      '下午了',           // 13-18 点
      '光开始斜了',
      '是一天里最容易犯困的时候',
      '午后总是过得慢',
      '窗外没什么声音',
      '下午还长',
      '阳光挪到了桌子这头',
      '这会儿时间最不好打发',
    ],
    evening: [
      '晚上了',           // 18-24 点
      '灯都亮起来了',
      '天黑了',
      '街上安静下来',
      '今天到这儿',
      '夜晚才刚开始',
      '楼下的人陆续回来了',
      '一天里最松的时候',
    ],
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
    themeLabel: '主题',
    theme: {
      light: '亮色',
      dark: '暗色',
      system: '跟随系统',
    },
    searchOpacity: '搜索框透明度',
    // 顺序必须与 wallpaper.js 的 SOLID_PRESETS / GRADIENT_PRESETS 数组严格对应
    colorPreset: ['浅灰', '墨黑', '雾蓝', '樱粉', '薄荷绿', '米黄', '石板蓝', '深青'],
    gradientPreset: ['紫罗兰渐变', '日落渐变', '清新渐变', '天蓝渐变', '深海渐变', '石墨渐变'],
    customColorLabel: '自定义颜色',
    hourFormat: '时间格式',
    hourFormatAuto: '自动',
    hourFormat12: '12 小时制',
    hourFormat24: '24 小时制',
    engine: '默认搜索引擎',
    autoFocus: '自动聚焦搜索框',
    autoFocusHint: '进入页面时自动聚焦搜索框（触屏设备建议关闭，避免自动弹出软键盘）',
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
    importInvalidSchema: '文件结构不正确，可能不是本应用的备份',
    importTooLarge: '文件超过 5MB',
    importVersionWarning: '配置来自更高版本，可能不兼容',
    wallpaperDiscarded: '本地图片壁纸未随配置导入，已回退为纯色',
    fileInputLabel: '选择配置文件',
  },
  date: {
    // 索引与 Date.getDay() 对应：0 = 周日
    weekdays: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    template: '{year}年{month}月{day}日 {weekday}',
    am: '上午',
    pm: '下午',
  },
};
