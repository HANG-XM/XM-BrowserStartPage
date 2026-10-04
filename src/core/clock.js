/**
 * clock.js —— 时间与日期模块
 *
 * - 每秒刷新一次时间（默认 24 小时制 HH:MM，可在设置中切为 12 小时制）
 * - 日期格式随当前语言变化：
 *     中文：2026年10月4日 星期日
 *     英文：Sunday, October 4, 2026
 * - 页面不可见时暂停计时，回到前台立即补帧并恢复
 * - 切换语言时立即重渲染日期
 */
import { formatTime } from '../utils/helpers.js';
import { formatDate, onLanguageChange } from '../i18n/index.js';
import { storage } from '../storage/storage.js';

/**
 * 初始化时钟模块
 * @returns {() => void} 清理函数：停止计时并移除所有事件监听
 */
export function initClock() {
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  if (!clockEl || !dateEl) return () => {};

  let timerId = null;

  /** 渲染一帧：时间 + 日期 */
  function render() {
    const now = new Date();
    // 每次渲染都读取最新配置，设置变更后一秒内即可生效
    const hour12 = storage.load().hourFormat === '12';
    clockEl.textContent = formatTime(now, hour12);
    // datetime 属性始终使用 24 小时制，保证语义化取值稳定
    clockEl.setAttribute('datetime', formatTime(now));
    dateEl.textContent = formatDate(now);
  }

  function start() {
    stop();
    render();
    timerId = setInterval(render, 1000);
  }

  function stop() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  /** 页面不可见时暂停，可见时重启（start 内会先补一帧，避免显示过期时间） */
  function handleVisibilityChange() {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  }

  start();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  const offLanguageChange = onLanguageChange(render);

  return function cleanupClock() {
    stop();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    offLanguageChange();
  };
}
