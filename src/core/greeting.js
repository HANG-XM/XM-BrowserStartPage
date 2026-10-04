/**
 * greeting.js —— 问候语模块
 *
 * 按当前小时输出时段问候（文案取自语言包）：
 *   0-5 凌晨好 / 5-12 早上好 / 12-18 下午好 / 18-24 晚上好
 * 每分钟检查一次是否跨入新时段；切换语言时立即刷新。
 */
import { t, onLanguageChange } from '../i18n/index.js';

/** 时段表：起始小时 → 语言包键（按 from 升序排列） */
const PERIODS = [
  { from: 0, key: 'greeting.dawn' },
  { from: 5, key: 'greeting.morning' },
  { from: 12, key: 'greeting.afternoon' },
  { from: 18, key: 'greeting.evening' },
];

/** 根据小时取对应时段的语言包键 */
function getPeriodKey(hour) {
  // 倒序找到最后一个 from <= hour 的时段
  for (let i = PERIODS.length - 1; i >= 0; i--) {
    if (hour >= PERIODS[i].from) return PERIODS[i].key;
  }
  return PERIODS[0].key;
}

/**
 * 初始化问候语模块
 * @returns {() => void} 清理函数：停止定时检查并取消语言订阅
 */
export function initGreeting() {
  const el = document.getElementById('greeting');
  if (!el) return () => {};

  function render() {
    el.textContent = t(getPeriodKey(new Date().getHours()));
  }

  render();
  // 每分钟检查一次是否跨入新时段
  const timerId = setInterval(render, 60 * 1000);
  const offLanguageChange = onLanguageChange(render);

  return function cleanupGreeting() {
    clearInterval(timerId);
    offLanguageChange();
  };
}
