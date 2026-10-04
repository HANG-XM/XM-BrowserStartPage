/**
 * helpers.js —— 通用工具函数
 * 只放与业务无关的纯函数
 */

/**
 * 将 Date 格式化为时间字符串
 * @param {Date} date
 * @param {boolean} [hour12=false] 是否使用 12 小时制
 * @returns {string} 24 小时制："09:05"；12 小时制："9:05 AM"
 */
export function formatTime(date, hour12 = false) {
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (!hour12) {
    const hours = String(date.getHours()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  const h24 = date.getHours();
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 || 12; // 0 点显示为 12，13 点显示为 1
  return `${h12}:${minutes} ${period}`;
}

/**
 * 校验字符串是否为合法的 http/https URL
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
