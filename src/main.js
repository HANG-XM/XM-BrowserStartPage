/**
 * main.js —— 应用入口
 *
 * 职责：仅做初始化与各功能模块的装配，
 * 不包含任何具体业务逻辑。
 */

import { initI18n } from './i18n/index.js?v=20261004';
import { initClock } from './core/clock.js?v=20261004';
import { initGreeting } from './core/greeting.js?v=20261004';
import { initSearch } from './core/search.js?v=20261004';
import { initTheme } from './core/theme.js?v=20261004';
import { initWallpaper } from './core/wallpaper.js?v=20261004';
import { initSettings } from './settings/settings.js?v=20261004';
import { storage } from './storage/storage.js?v=20261004';

function bootstrap() {
  // 读取本地配置（含 version 字段），后续据此恢复主题 / 壁纸 / 制式等
  const config = storage.load();
  console.debug('[XM] 已加载本地配置：', config);

  // 1. 初始化多语言（同步 <html lang> 与页面标题），必须先于各渲染模块
  initI18n();

  // 2. 启动功能模块；init 返回对应的清理函数
  const cleanupTheme = initTheme();
  const cleanupWallpaper = initWallpaper();
  const cleanupClock = initClock();
  const cleanupGreeting = initGreeting();
  const cleanupSearch = initSearch();
  // 设置面板依赖以上模块，放最后
  const cleanupSettings = initSettings();

  // 页面卸载时统一释放资源
  window.addEventListener('beforeunload', () => {
    cleanupTheme();
    cleanupWallpaper();
    cleanupClock();
    cleanupGreeting();
    cleanupSearch();
    cleanupSettings();
  });
}

bootstrap();
