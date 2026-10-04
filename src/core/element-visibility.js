/**
 * element-visibility.js —— 主页面元素显隐
 *
 * - 读取 storage.showGreeting / showDate，用 HTML hidden 属性控制 #greeting / #date
 * - 只操作 hidden 属性，不写内联样式、不新增工具类
 * - 隐藏后 greeting.js / clock.js 仍照常更新文本，恢复显示时即为最新内容
 */
import { storage } from '../storage/storage.js';

/** 按当前配置应用问候语 / 日期的显隐 */
export function applyVisibility() {
  const config = storage.load();
  const greetingEl = document.getElementById('greeting');
  const dateEl = document.getElementById('date');
  if (greetingEl) greetingEl.hidden = config.showGreeting === false;
  if (dateEl) dateEl.hidden = config.showDate === false;
}

/**
 * 初始化元素显隐模块
 * @returns {() => void} 清理函数
 */
export function initVisibility() {
  applyVisibility();
  return function cleanupVisibility() {
    // 无持久监听，无需释放
  };
}
