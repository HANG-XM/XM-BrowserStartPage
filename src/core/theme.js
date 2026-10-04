/**
 * theme.js —— 主题模块（亮色 / 暗色 / 跟随系统）
 *
 * 职责：
 * - 管理主题模式（'light' | 'dark' | 'system'），持久化到 storage
 * - 解析实际生效主题（'light' | 'dark'）并写到 <html data-theme>
 * - system 模式下监听系统主题变化，自动重解析
 *
 * 注意：首屏防闪白由 index.html 中的内联脚本完成，本模块接管后续切换。
 * 主题切换 UI 由设置面板（settings.js）提供。
 */
import { storage } from '../storage/storage.js';

/** 合法主题模式 */
const MODES = ['light', 'dark', 'system'];

/** 系统暗色偏好媒体查询（模块级复用，避免重复创建） */
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

/** 当前主题模式：以本地配置为准，非法值回退 system */
const savedMode = storage.load().theme;
let currentMode = MODES.includes(savedMode) ? savedMode : 'system';

/** 获取当前主题模式：'light' | 'dark' | 'system' */
export function getThemeMode() {
  return currentMode;
}

/** 获取实际生效的主题：'light' | 'dark'（system 会被解析） */
export function getResolvedTheme() {
  if (currentMode === 'system') return mediaQuery.matches ? 'dark' : 'light';
  return currentMode;
}

/**
 * 设置主题模式并持久化
 * @param {'light'|'dark'|'system'} mode
 */
export function setThemeMode(mode) {
  if (!MODES.includes(mode) || mode === currentMode) return;
  currentMode = mode;
  storage.update({ theme: mode });
  applyTheme();
}

/** 将解析结果写入 <html data-theme> */
function applyTheme() {
  document.documentElement.dataset.theme = getResolvedTheme();
}

/** 系统主题变化时重解析（仅在 system 模式下需要响应） */
function handleSystemChange() {
  if (currentMode === 'system') applyTheme();
}

/**
 * 初始化主题模块
 * @returns {() => void} 清理函数：取消 matchMedia 监听
 */
export function initTheme() {
  applyTheme();
  mediaQuery.addEventListener('change', handleSystemChange);

  return function cleanupTheme() {
    mediaQuery.removeEventListener('change', handleSystemChange);
  };
}
