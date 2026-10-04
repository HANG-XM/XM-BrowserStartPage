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
const STORAGE_VERSION = 1;

/** 默认配置：首次运行或读取失败时的兜底值 */
const DEFAULT_CONFIG = {
  version: STORAGE_VERSION,
  theme: 'system',          // 'light' | 'dark' | 'system'
  hourFormat: '24',         // 时钟制式：'12' | '24'
  searchEngine: 'bing',     // 默认搜索引擎标识
  searchBoxAlpha: 0.65,     // 搜索框玻璃底不透明度 0.35~1.0
  wallpaper: {
    type: 'solid',          // 'solid' | 'gradient' | 'local'
    value: '',              // solid=CSS颜色；gradient=CSS渐变；local=IndexedDB 图片 id；空串=无壁纸
    overlay: 0.3,           // 遮罩透明度 0~1
    blur: 0,                // 背景模糊像素 0~20
  },
};

/**
 * 版本迁移占位：配置结构变更时在此按旧版本号逐级升级
 * @param {object} data 从 localStorage 读出的旧配置
 * @returns {object} 迁移到当前版本的配置
 */
function migrate(data) {
  // 示例：if (data.version < 1) { ...升级字段... }
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
      return migrate(JSON.parse(raw));
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
