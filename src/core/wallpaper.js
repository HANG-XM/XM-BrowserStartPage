/**
 * wallpaper.js —— 壁纸模块
 *
 * 支持三种壁纸：纯色 solid / 渐变 gradient / 本地图片 local（存 IndexedDB）。
 * 配置结构：{ type, value, overlay, blur }
 *   - solid：value 为 CSS 颜色；gradient：value 为 CSS 渐变；local：value 为 IndexedDB 图片 id
 *   - value 为空串表示无壁纸（透出主题背景色）
 *   - overlay：遮罩透明度 0~1（遮罩颜色走 CSS 变量，随主题自动切换）
 *   - blur：背景模糊像素 0~20
 *
 * 每日轮换（wallpaperDailyRotate）：
 *   - 开启后从 SOLID_PRESETS + GRADIENT_PRESETS 合并池按「本地日期」确定性选一张
 *   - 轮换只在应用层派生，绝不改写 storage.wallpaper（用户手动偏好）
 *   - 本地图片（type=local）优先级最高，轮换永不覆盖
 *   - 用户手动选择壁纸时自动关闭轮换并提示；遮罩/模糊滑块不触发关闭
 *
 * 设置面板内的壁纸控件由 settings.js 动态构建，本模块只负责数据与应用；
 * Object URL 在替换与清理时统一 revoke。
 */

import { storage } from '../storage/storage.js';
import * as wallpaperStore from '../storage/wallpaper-store.js';
import { t } from '../i18n/index.js';
import { showToast } from '../ui/toast.js';
import { hashSeed } from './greeting.js';

/** 默认壁纸配置 */
const DEFAULT_WALLPAPER = { type: 'solid', value: '', overlay: 0.3, blur: 0 };

/** 预设纯色 / 渐变（属于壁纸内容数据，非组件样式），供设置面板复用 */
export const SOLID_PRESETS = ['#f5f6f8', '#111318', '#dbeafe', '#fce7f3', '#dcfce7', '#fef3c7', '#1e293b', '#0f766e'];
export const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #232526 0%, #414345 100%)',
];

/**
 * 每日轮换池：纯色 + 渐变合并（下标 0~7 纯色，8~13 渐变）
 * 顺序调整会改变历史日期的选取结果，勿轻易变动
 */
const DAILY_POOL = [
  ...SOLID_PRESETS.map((value) => ({ type: 'solid', value })),
  ...GRADIENT_PRESETS.map((value) => ({ type: 'gradient', value })),
];

/** 旧版配置类型映射（color→solid、image→local、url 已废弃→solid） */
const LEGACY_TYPE_MAP = { color: 'solid', image: 'local', url: 'solid' };

let currentConfig = normalizeConfig(storage.load().wallpaper);
// 每日轮换开关缓存：init 时读一次，setDailyRotate/setWallpaper 同步更新
// （避免滑块拖动的高频路径每次 input 都 storage.load() 触发 JSON.parse）
let cachedDailyRotate = false;
let currentObjectUrl = null; // 当前壁纸的 Object URL（type=local）
let applySeq = 0;            // 异步应用序号，防止快速切换时的竞态

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** 规范化配置：兼容旧类型、收敛取值范围 */
function normalizeConfig(raw) {
  const cfg = { ...DEFAULT_WALLPAPER, ...(raw || {}) };
  if (LEGACY_TYPE_MAP[cfg.type]) cfg.type = LEGACY_TYPE_MAP[cfg.type];
  if (!['solid', 'gradient', 'local'].includes(cfg.type)) cfg.type = 'solid';
  cfg.overlay = clamp(Number.isFinite(+cfg.overlay) ? +cfg.overlay : DEFAULT_WALLPAPER.overlay, 0, 1);
  cfg.blur = clamp(Number.isFinite(+cfg.blur) ? +cfg.blur : DEFAULT_WALLPAPER.blur, 0, 20);
  if (typeof cfg.value !== 'string') cfg.value = '';
  return cfg;
}

/**
 * 本地日期字符串 YYYY-MM-DD（按本地时区，避免 toISOString 的 UTC 偏差）
 * @param {Date} [date]
 * @returns {string}
 */
function localDateStr(date) {
  const d = date || new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 解析当前实际生效的壁纸配置：
 * ① 用户本地图片（type=local）：最高优先，轮换永不覆盖
 * ② 轮换开启且当前非 local：派生今日预设（overlay/blur 沿用用户配置），不写 storage
 * ③ 其余：用户手动配置
 * @returns {{cfg: object, isDaily: boolean}}
 */
function resolveEffectiveConfig() {
  // currentConfig 是用户手动偏好（setOverlay/setBlur 后也是最新的）
  if (currentConfig.type === 'local') return { cfg: currentConfig, isDaily: false };
  if (cachedDailyRotate === true) {
    const pick = DAILY_POOL[hashSeed(localDateStr()) % DAILY_POOL.length];
    return { cfg: { ...currentConfig, ...pick }, isDaily: true };
  }
  return { cfg: currentConfig, isDaily: false };
}

/** 指定配置是否有实际壁纸（无壁纸时遮罩强制为 0，避免洗掉主题背景色） */
function hasActiveWallpaper(cfg) {
  return cfg.value !== '';
}

// ============================================================
// 公共 API
// ============================================================

/** 获取当前壁纸配置（用户手动偏好的副本，不含轮换派生值） */
export function getWallpaper() {
  return { ...currentConfig };
}

/** 保存并应用壁纸配置（增量合并）；轮换开启时手动选择自动关闭轮换 */
export function setWallpaper(config) {
  const prev = currentConfig;
  currentConfig = normalizeConfig({ ...currentConfig, ...config });
  // 用户主动选壁纸 → 退出每日轮换（setOverlay/setBlur 不走本函数，不会误关）
  if (cachedDailyRotate === true) {
    cachedDailyRotate = false;
    storage.update({ wallpaperDailyRotate: false });
    showToast(t('settings.dailyWallpaperManual'), 'info');
  }
  storage.update({ wallpaper: currentConfig });
  applyWallpaper();
  // 替换本地图片时删除旧记录，避免 IndexedDB 垃圾堆积
  if (prev.type === 'local' && prev.value && prev.value !== currentConfig.value) {
    wallpaperStore.deleteImage(prev.value).catch((err) => console.error('[wallpaper] 清理旧图片失败：', err));
  }
}

/**
 * 开启 / 关闭每日轮换
 * @param {boolean} enabled
 */
export function setDailyRotate(enabled) {
  cachedDailyRotate = Boolean(enabled);
  storage.update({ wallpaperDailyRotate: cachedDailyRotate });
  // 当前是本地图片时开启也不生效，给出提示
  if (enabled && currentConfig.type === 'local') {
    showToast(t('settings.dailyWallpaperLocalActive'), 'warning');
  }
  applyWallpaper();
}

/** 设置遮罩透明度（0~1） */
export function setOverlay(opacity) {
  currentConfig.overlay = clamp(opacity, 0, 1);
  applyEffects();
  scheduleSave();
}

/** 设置背景模糊（0~20px） */
export function setBlur(px) {
  currentConfig.blur = clamp(px, 0, 20);
  applyEffects();
  scheduleSave();
}

// ============================================================
// 应用渲染
// ============================================================

/**
 * 应用壁纸到背景层（local 类型为异步）
 */
export async function applyWallpaper() {
  const layer = document.getElementById('wallpaper');
  if (!layer) return;
  const seq = ++applySeq;

  // 生效配置：可能是轮换派生值（不写 storage）
  const { cfg: effective } = resolveEffectiveConfig();
  const { type, value } = effective;
  let background = '';
  let newObjectUrl = null;

  if (type === 'solid' || type === 'gradient') {
    background = value || '';
  } else if (type === 'local' && value) {
    try {
      const blob = await wallpaperStore.getImage(value);
      if (seq !== applySeq) return; // 期间已被更新的应用覆盖
      if (!blob) throw new Error('图片记录不存在');
      newObjectUrl = URL.createObjectURL(blob);
      background = `url("${newObjectUrl}")`;
    } catch (err) {
      console.error('[wallpaper] 本地图片加载失败，回退默认背景：', err);
      showToast(t('wallpaper.loadError'), 'warning');
      // 回退：清空壁纸引用并持久化
      currentConfig = { ...currentConfig, type: 'solid', value: '' };
      storage.update({ wallpaper: currentConfig });
      background = '';
    }
  }

  // 先赋值 DOM，再释放旧 URL，避免空窗
  if (newObjectUrl) {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = newObjectUrl;
  } else if (type !== 'local' && currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  // catch 分支可能已把 currentConfig 改写为 solid 回退，后续必须读最新的 currentConfig.type
  const finalType = currentConfig.type === 'local' && seq === applySeq ? 'local' : (background ? type : 'solid');
  layer.dataset.wallpaperType = finalType; // 供 CSS 按壁纸类型控制噪点纹理（仅 solid/gradient 显示）
  // 按类型分属性写，避免 background 简写属性覆盖 CSS 的 background-size/position/repeat
  if (finalType === 'solid') {
    layer.style.backgroundColor = background;
    layer.style.backgroundImage = '';
  } else {
    layer.style.backgroundColor = '';
    layer.style.backgroundImage = background; // gradient / local 均走 backgroundImage
  }
  applyEffects();
}

/** 仅应用遮罩与模糊（不重载背景图，供滑块高频调用） */
function applyEffects() {
  const layer = document.getElementById('wallpaper');
  const overlayEl = document.getElementById('wallpaper-overlay');
  if (!layer || !overlayEl) return;
  // 轮换开启时遮罩/模糊也要跟随当日壁纸，故读生效配置
  const { cfg: effective } = resolveEffectiveConfig();
  const { blur, overlay } = effective;
  layer.style.filter = blur > 0 ? `blur(${blur}px)` : '';
  layer.style.transform = blur > 0 ? 'scale(1.05)' : ''; // 模糊时略放大，避免边缘透明
  overlayEl.style.opacity = hasActiveWallpaper(effective) ? String(overlay) : '0';
}

/** 防抖持久化（滑块拖动时避免高频写入 localStorage） */
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => storage.update({ wallpaper: currentConfig }), 300);
}

// ============================================================
// 初始化
// ============================================================

/**
 * 初始化壁纸模块：应用已有配置并返回清理函数
 * @returns {() => void} 清理函数：释放 timer / Object URL / 事件监听
 */
export function initWallpaper() {
  // 跨天自动重算：仅在轮换可能生效时（开关开且非 local）
  cachedDailyRotate = storage.load().wallpaperDailyRotate === true;
  let lastAppliedDate = localDateStr();
  function handleVisibilityChange() {
    if (document.hidden) return;
    const today = localDateStr();
    if (today !== lastAppliedDate) {
      lastAppliedDate = today;
      if (cachedDailyRotate === true && currentConfig.type !== 'local') {
        applyWallpaper();
      }
    }
  }

  applyWallpaper();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return function cleanupWallpaper() {
    clearTimeout(saveTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  };
}
