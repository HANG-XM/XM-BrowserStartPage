/**
 * helpers.js —— 通用工具函数
 * 只放与业务无关的纯函数
 */

/**
 * 将 Date 格式化为时间字符串
 * @param {Date} date
 * @param {boolean} [hour12=false] 是否使用 12 小时制
 * @param {{ am: string, pm: string }} [periods] 12 小时制的上午/下午文案
 * @param {boolean} [showSeconds=false] 是否显示秒数（HH:MM:SS / h:MM:SS AM）
 * @returns {string} 24 小时制："09:05" 或 "09:05:30"；12 小时制："9:05 AM" 或 "9:05:30 AM"
 */
export function formatTime(date, hour12 = false, periods = { am: 'AM', pm: 'PM' }, showSeconds = false) {
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const suffix = showSeconds ? `:${seconds}` : '';
  if (!hour12) {
    const hours = String(date.getHours()).padStart(2, '0');
    return `${hours}:${minutes}${suffix}`;
  }
  const h24 = date.getHours();
  const period = h24 < 12 ? periods.am : periods.pm;
  const h12 = h24 % 12 || 12; // 0 点显示为 12，13 点显示为 1
  return `${h12}:${minutes}${suffix} ${period}`;
}
