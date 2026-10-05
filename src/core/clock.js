/**
 * clock.js —— 时间与日期模块
 *
 * - 每秒刷新一次时间（默认 24 小时制 HH:MM，可在设置中切为自动 / 12 小时制）
 * - 日期格式随当前语言变化：
 *     中文：2026年10月4日 星期日
 *     英文：Sunday, October 4, 2026
 * - 页面不可见时暂停计时，回到前台立即补帧并恢复
 * - 切换语言时立即重渲染日期
 * - 设置面板切换制式后调用 refreshClock() 立即生效
 */
import { formatTime } from '../utils/helpers.js';
import { formatDate, onLanguageChange, t } from '../i18n/index.js';
import { storage } from '../storage/storage.js';

/**
 * 将制式配置解析为是否 12 小时制
 * @param {'auto'|'12'|'24'} fmt
 * @returns {boolean}
 */
// auto 模式的 12/24 小时偏好：系统/区域设置在页面生命周期内不变，首次计算后缓存
let cachedAutoHour12 = null;

function resolveHour12(fmt) {
  if (fmt === '12') return true;
  if (fmt === '24') return false;
  // auto：跟随运行环境（系统 / 语言区域）的 12/24 小时偏好
  if (cachedAutoHour12 === null) {
    cachedAutoHour12 = Boolean(Intl.DateTimeFormat().resolvedOptions().hour12);
  }
  return cachedAutoHour12;
}

// 模块级制式状态：init 时读一次，refreshClock() 时更新（不每秒读 storage）
let currentHourFormat = storage.load().hourFormat;
// 当前 init 注册的渲染函数（未 init 或已 cleanup 时为 null）
let activeRender = null;

/**
 * 设置面板切换时钟制式后调用：重读配置并立即补一帧
 */
export function refreshClock() {
  currentHourFormat = storage.load().hourFormat;
  if (activeRender) activeRender();
}

/**
 * 初始化时钟模块
 * @returns {() => void} 清理函数：停止计时并移除所有事件监听
 */
export function initClock() {
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  if (!clockEl || !dateEl) return () => {};

  let timerId = null;
  let timeoutId = null;
  let lastDateStr = '';

  /** 渲染一帧：时间 + 日期 */
  function render() {
    const now = new Date();
    const hour12 = resolveHour12(currentHourFormat);
    clockEl.textContent = formatTime(now, hour12, { am: t('date.am'), pm: t('date.pm') });
    // datetime 属性始终使用 24 小时制，保证语义化取值稳定
    clockEl.setAttribute('datetime', formatTime(now, false));
    // 日期跨天才重写
    const dateStr = now.toDateString();
    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      dateEl.textContent = formatDate(now);
    }
  }
  activeRender = render;

  function start() {
    stop();
    render();
    // 对齐到下一个整秒再启动 interval
    const msToNextSecond = 1000 - (Date.now() % 1000);
    timeoutId = setTimeout(() => {
      render();
      timerId = setInterval(render, 1000);
    }, msToNextSecond);
  }

  function stop() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
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
    activeRender = null;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    offLanguageChange();
  };
}
