/**
 * theme.js —— 主题模块（亮色 / 暗色 / 跟随系统）
 *
 * 职责：
 * - 管理主题模式（'light' | 'dark' | 'system'），持久化到 storage
 * - 解析实际生效主题（'light' | 'dark'）并写到 <html data-theme>
 * - system 模式下监听系统主题变化，自动重解析
 * - 接管右上角临时主题切换按钮（后续由设置面板替换为正式控件）
 * - 提供 onThemeChange 订阅，实际生效值变化时通知订阅者（预留）
 *
 * 注意：首屏防闪白由 index.html 中的内联脚本完成，本模块接管后续切换。
 */
import { storage } from '../storage/storage.js';
import { t, onLanguageChange } from '../i18n/index.js';

/** 合法主题模式，数组顺序即按钮循环切换顺序 */
const MODES = ['light', 'dark', 'system'];

/** 系统暗色偏好媒体查询（模块级复用，避免重复创建） */
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

/** 当前主题模式：以本地配置为准，非法值回退 system */
const savedMode = storage.load().theme;
let currentMode = MODES.includes(savedMode) ? savedMode : 'system';

/** 上次生效的解析结果，用于避免重复通知订阅者 */
let lastResolved = null;

/** 主题订阅者 */
const listeners = new Set();

/** 三种模式对应的内联 SVG 图标：太阳 / 月亮 / 半圆 */
const ICONS = {
  light:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>',
  dark:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  system:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>',
};

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

/**
 * 订阅主题变化：仅当实际生效值（light/dark）变化时触发
 * @param {(resolved: string, mode: string) => void} fn
 * @returns {() => void} 取消订阅函数
 */
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 将解析结果写入 <html data-theme>，生效值变化时通知订阅者 */
function applyTheme() {
  const resolved = getResolvedTheme();
  document.documentElement.dataset.theme = resolved;
  if (resolved !== lastResolved) {
    lastResolved = resolved;
    listeners.forEach((fn) => fn(resolved, currentMode));
  }
}

/**
 * 初始化临时主题切换按钮
 * 点击循环：light → dark → system → light
 * @returns {() => void} 清理函数
 */
function initToggleButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return () => {};

  /** 按当前模式刷新图标与无障碍文案 */
  function renderButton() {
    btn.innerHTML = ICONS[currentMode];
    btn.setAttribute('aria-label', t(`theme.${currentMode}`));
    btn.title = t('theme.toggle');
  }

  function handleClick() {
    const next = MODES[(MODES.indexOf(currentMode) + 1) % MODES.length];
    setThemeMode(next);
    renderButton();
  }

  renderButton();
  btn.addEventListener('click', handleClick);
  // 语言切换时同步刷新按钮文案
  const offLanguageChange = onLanguageChange(renderButton);

  return () => {
    btn.removeEventListener('click', handleClick);
    offLanguageChange();
  };
}

/** 系统主题变化时重解析（仅在 system 模式下需要响应） */
function handleSystemChange() {
  if (currentMode === 'system') applyTheme();
}

/**
 * 初始化主题模块
 * @returns {() => void} 清理函数：取消 matchMedia 监听与按钮事件
 */
export function initTheme() {
  applyTheme();
  mediaQuery.addEventListener('change', handleSystemChange);
  const cleanupButton = initToggleButton();

  return function cleanupTheme() {
    mediaQuery.removeEventListener('change', handleSystemChange);
    cleanupButton();
    listeners.clear();
  };
}
