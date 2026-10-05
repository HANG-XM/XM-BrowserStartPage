/**
 * storage.js —— 本地持久化封装（localStorage）
 *
 * 数据约定：
 * - 所有配置保存在单个 key 下，值为 JSON 字符串
 * - 顶层必带 version 字段，未来配置结构变更时按版本号逐级迁移
 *
 * 注意：本地图片壁纸等二进制数据后续放 IndexedDB（MVP-6），
 * 本模块只处理可 JSON 序列化的配置项。
 */

const STORAGE_KEY = 'xm-startpage:config';
const STORAGE_VERSION = 2;

/** 是否为触屏设备：触屏默认不自动聚焦搜索框（避免移动端一进页面就弹软键盘） */
function getDefaultAutoFocus() {
  return !window.matchMedia('(pointer: coarse)').matches;
}

/** 默认配置：首次运行或读取失败时的兜底值 */
const DEFAULT_CONFIG = {
  version: STORAGE_VERSION,
  theme: 'system',          // 'light' | 'dark' | 'system'
  hourFormat: '24',         // 时钟制式：'auto' | '12' | '24'
  showSeconds: false,       // N4：时钟是否显示秒数
  searchEngine: 'bing',     // 默认搜索引擎标识
  searchBoxTransparency: 65, // 搜索框玻璃底透明度（UI 值 0~100，0=不透明，100=完全透明）
  autoFocus: getDefaultAutoFocus(), // 进入页面时是否自动聚焦搜索框（触屏默认关闭）
  quickLinks: [],          // 快速链接：每项 { id, title, url }，最多 8 个
  showGreeting: true,      // 是否显示问候语
  showDate: true,          // 是否显示日期
  wallpaperDailyRotate: false, // 每日壁纸轮换：开启后从预设池按日期确定性选一张（不覆盖本地图片）
  searchOpenIn: 'new',     // 搜索结果打开方式：'new'（新标签页）| 'current'（当前页）
  wallpaper: {
    type: 'solid',          // 'solid' | 'gradient' | 'local'
    value: '',              // solid=CSS颜色；gradient=CSS渐变；local=IndexedDB 图片 id；空串=无壁纸
    overlay: 0.3,           // 遮罩透明度 0~1
    blur: 0,                // 背景模糊像素 0~20
  },
};

/**
 * 版本迁移：配置结构变更时在此按旧版本号逐级升级
 * @param {object} data 从 localStorage 读出的旧配置
 * @returns {object} 迁移到当前版本的配置
 */
function migrate(data) {
  // version 缺失（最早版本）按 1 处理
  const oldVersion = typeof data.version === 'number' ? data.version : 1;
  // 未来版本：原样返回，不做降级处理
  if (oldVersion > STORAGE_VERSION) return data;

  // 通用补默认值：顶层缺失字段由 spread 自动取自 DEFAULT_CONFIG。
  // 同版本内新增字段（如 quickLinks / showGreeting / showDate）无需逐字段 if，
  // 只需把字段加入 DEFAULT_CONFIG；嵌套对象需保证整体存在。
  return { ...DEFAULT_CONFIG, ...data, version: STORAGE_VERSION };
}

export const storage = {
  /**
   * 读取配置；不存在或解析失败时返回默认配置
   * @returns {object} 配置对象（保证含 version 字段）
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      const oldVersion = typeof parsed.version === 'number' ? parsed.version : 1;
      const migrated = migrate(parsed);
      // 写回条件：
      // ① 发生过版本升级；② 同版本内 DEFAULT_CONFIG 新增了顶层字段（老 v2 配置缺字段）
      // 未来版本（oldVersion > 当前）不写回，避免降级
      const missingTopFields = Object.keys(DEFAULT_CONFIG)
        .some((key) => parsed[key] === undefined);
      if (oldVersion < STORAGE_VERSION || missingTopFields) {
        this.save(migrated);
      }
      return migrated;
    } catch (err) {
      console.error('[storage] 读取配置失败，已回退默认配置：', err);
      return { ...DEFAULT_CONFIG };
    }
  },

  /**
   * 全量写入配置（自动附加当前版本号）
   * @param {object} config
   * @returns {boolean} 是否写入成功
   */
  save(config) {
    try {
      const data = { ...config, version: STORAGE_VERSION };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      // 隐私模式 / 配额满等场景下写入会抛错
      console.error('[storage] 写入配置失败：', err);
      return false;
    }
  },

  /**
   * 局部更新：浅合并补丁后整体写回
   * @param {object} patch 需要更新的字段
   * @returns {boolean} 是否写入成功
   */
  update(patch) {
    return this.save({ ...this.load(), ...patch });
  },

  /** 清空配置，恢复初始状态 */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
