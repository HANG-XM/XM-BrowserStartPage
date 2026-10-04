/**
 * backup.js —— 配置导入 / 导出
 *
 * 职责：
 * - exportConfig()      汇总所有 xm-startpage: 前缀的 localStorage 项，下载为 JSON 文件
 * - validateBackup()    校验备份文件结构
 * - importConfig()      全覆盖写入（先快照，失败回滚）
 * - readFileAsJson()    FileReader 读取并解析 JSON
 *
 * 边界约定：
 * - 本地图片壁纸存于 IndexedDB（Blob），不随配置导出；
 *   导出时若壁纸为 local 类型，回退为纯色并打 __wallpaperLocalDiscarded 标记。
 * - 导入仅写入 xm-startpage: 前缀的键，其余键跳过并警告。
 * - 不做云同步 / 自动备份 / 增量合并（全覆盖）。
 */

/** 应用版本号（设置面板「关于」也引用此常量） */
export const APP_VERSION = '0.1.0';

/** 备份文件结构版本：结构变更时递增 */
const SCHEMA_VERSION = 1;

/** 本应用 localStorage 键前缀，导入 / 导出 / 回滚均以此过滤 */
const KEY_PREFIX = 'xm-startpage:';

/** 主配置键（与 storage.js 的 STORAGE_KEY 保持一致） */
const CONFIG_KEY = 'xm-startpage:config';

/** 导入文件大小上限：5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 生成本地时间戳：YYYYMMDD-HHMMSS（用于导出文件名） */
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * 快照当前所有本应用前缀的 localStorage 项（导入前调用，用于失败回滚）
 * @returns {Object<string, string>} 键 → 原始字符串值
 */
function snapshotPrefix() {
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX)) snap[key] = localStorage.getItem(key);
  }
  return snap;
}

/**
 * 回滚：清空当前所有本应用前缀的键，写回快照
 * @param {Object<string, string>} snap snapshotPrefix() 的产物
 */
function restorePrefix(snap) {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(KEY_PREFIX)) toRemove.push(key);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  Object.entries(snap).forEach(([k, v]) => localStorage.setItem(k, v));
}

/**
 * 导出配置：收集 → 组装 → 触发下载
 * @returns {{ ok: true } | { ok: false, error: unknown }}
 */
export function exportConfig() {
  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      // 尽量还原为结构化数据（如主配置对象），解析失败则保留原始字符串（如语言代码）
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }

    // 本地图片壁纸不随配置导出：回退为纯色并打标记，导入方据此提示用户
    const config = data[CONFIG_KEY];
    if (config && typeof config === 'object' && config.wallpaper && config.wallpaper.type === 'local') {
      config.wallpaper = { ...config.wallpaper, type: 'solid', value: '' };
      data.__wallpaperLocalDiscarded = true;
    }

    const payload = {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xm-startpage-backup-${timestamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (err) {
    console.error('[backup] 导出失败：', err);
    return { ok: false, error: err };
  }
}

/**
 * 校验备份文件结构
 * @param {unknown} json JSON.parse 后的值
 * @returns {{ ok: true, payload: object, warning: string | null } | { ok: false, reason: string }}
 *   reason: 'invalid-schema' | 'invalid-data'
 *   warning: 'newer-version'（配置来自更高版本，允许继续但提示可能不兼容）
 */
export function validateBackup(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { ok: false, reason: 'invalid-schema' };
  }
  if (typeof json.schemaVersion !== 'number') {
    return { ok: false, reason: 'invalid-schema' };
  }
  if (!json.data || typeof json.data !== 'object' || Array.isArray(json.data)) {
    return { ok: false, reason: 'invalid-data' };
  }
  // 值必须是 JSON 可序列化类型（对象键在 JS 中必然是字符串，无需再校验键）
  for (const value of Object.values(json.data)) {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
      return { ok: false, reason: 'invalid-data' };
    }
  }

  // TODO: schemaVersion < SCHEMA_VERSION 时按版本逐级迁移（当前仅 v1，暂无旧版本）
  const warning = json.schemaVersion > SCHEMA_VERSION ? 'newer-version' : null;
  return { ok: true, payload: json, warning };
}

/**
 * 导入配置（全覆盖）：先快照 → 清空所有前缀键 → 逐键写入 → 失败回滚
 * @param {object} payload validateBackup() 校验通过的备份对象
 * @returns {{ ok: true, wallpaperDiscarded: boolean } | { ok: false, error: unknown }}
 */
export function importConfig(payload) {
  // 顺序敏感：必须先快照（含即将被清空的所有前缀键），再清空，再写入
  // 失败时 restorePrefix 能把 localStorage 完整恢复到导入前状态
  const snap = snapshotPrefix();
  try {
    // 全覆盖：先清空当前所有本应用前缀键，避免目标环境残留合并进新配置
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));

    for (const [key, value] of Object.entries(payload.data)) {
      // 安全边界：仅写入本应用前缀的键，禁止写入任意 localStorage 键
      if (!key.startsWith(KEY_PREFIX)) {
        console.warn('[backup] 跳过非本应用键：', key);
        continue;
      }
      // 与导出时的解析对称：对象写回 JSON 字符串，字符串原样写入
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
    return { ok: true, wallpaperDiscarded: payload.data.__wallpaperLocalDiscarded === true };
  } catch (err) {
    console.error('[backup] 导入失败，已回滚到导入前状态：', err);
    restorePrefix(snap);
    return { ok: false, error: err };
  }
}

/**
 * 读取文件并解析为 JSON
 * @param {File} file 用户选择的文件
 * @returns {Promise<{ ok: true, json: unknown } | { ok: false, reason: string }>}
 *   reason: 'too-large' | 'invalid-json' | 'read-error'
 */
export function readFileAsJson(file) {
  return new Promise((resolve) => {
    if (file.size > MAX_FILE_SIZE) {
      resolve({ ok: false, reason: 'too-large' });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, reason: 'read-error' });
    reader.onload = () => {
      try {
        resolve({ ok: true, json: JSON.parse(String(reader.result)) });
      } catch {
        resolve({ ok: false, reason: 'invalid-json' });
      }
    };
    reader.readAsText(file);
  });
}
