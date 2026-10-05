/**
 * main.js —— 应用入口
 *
 * 职责：仅做初始化与各功能模块的装配，
 * 不包含任何具体业务逻辑。
 */

import { initI18n } from './i18n/index.js';
import { initClock } from './core/clock.js';
import { initGreeting } from './core/greeting.js';
import { initSearch } from './core/search.js';
import { initQuickLinks } from './core/quick-links.js';
import { initVisibility } from './core/element-visibility.js';
import { initTheme } from './core/theme.js';
import { initWallpaper } from './core/wallpaper.js';
import { initDragWallpaper } from './core/drag-wallpaper.js';
import { initSettings } from './settings/settings.js';
import { storage } from './storage/storage.js';

function bootstrap() {
  // 读取本地配置（含 version 字段），后续据此恢复主题 / 壁纸 / 制式等
  const config = storage.load();

  // 1. 初始化多语言（同步 <html lang> 与页面标题），必须先于各渲染模块
  initI18n();

  // 2. 启动功能模块；init 返回对应的清理函数
  const cleanupTheme = initTheme();
  const cleanupWallpaper = initWallpaper();
  const cleanupClock = initClock();
  const cleanupGreeting = initGreeting();
  const cleanupSearch = initSearch();
  const cleanupQuickLinks = initQuickLinks();
  const cleanupVisibility = initVisibility();
  const cleanupDragWallpaper = initDragWallpaper();
  // 设置面板依赖以上模块，放最后
  const cleanupSettings = initSettings();

  // 页面卸载时统一释放资源（pagehide 兼容 bfcache）
  window.addEventListener('pagehide', () => {
    cleanupTheme();
    cleanupWallpaper();
    cleanupClock();
    cleanupGreeting();
    cleanupSearch();
    cleanupQuickLinks();
    cleanupVisibility();
    cleanupDragWallpaper();
    cleanupSettings();
  });

  // 全部初始化完成：触发主内容首屏淡入（head 内联脚本另设 1s 兜底防白屏）
  document.documentElement.classList.add('ready');
}

bootstrap();
