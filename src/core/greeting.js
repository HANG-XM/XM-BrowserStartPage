/**
 * greeting.js —— 问候语模块
 *
 * 按当前小时输出时段问候。每个时段的文案是一个数组（候选池），
 * 用「本地日期 + 时段键」做 FNV-1a 哈希取模，**确定性地**选中其中一条：
 *   0-5 凌晨 / 5-11 早上 / 11-13 中午 / 13-18 下午 / 18-24 晚上
 * 每分钟检查一次是否跨时段 / 跨天；切换语言时立即刷新。
 *
 * 为什么用确定性选取而不是 Math.random()：
 *   - 起始页一天会被打开几十次，随机会让最弱的那条文案以固定概率反复成为页面的「声音」；
 *   - 确定性 = 同一天同一时段永远是同一句（稳定）、跨天自动更换（不僵死），
 *     且零存储、可复现、可测试（同一日期 + 同一时段在任何浏览器得到同一句）。
 *
 * ⚠ 维护提示：池长度即取模基数 —— 增删任一条文案都会改变当天所有用户看到的句子，属预期行为。
 */
import { t, tList, getLanguage, onLanguageChange } from '../i18n/index.js';

/** 时段表：起始小时 → 语言包键（按 from 升序排列，单一数据源） */
const PERIODS = [
  { from: 0, key: 'greeting.dawn' },
  { from: 5, key: 'greeting.morning' },
  { from: 11, key: 'greeting.noon' },
  { from: 13, key: 'greeting.afternoon' },
  { from: 18, key: 'greeting.evening' },
];

/**
 * 根据小时取对应时段的语言包键（纯函数，便于单独测试）
 * @param {number} hour 0-23
 * @returns {string}
 */
export function getPeriodKey(hour) {
  // 倒序找到最后一个 from <= hour 的时段
  for (let i = PERIODS.length - 1; i >= 0; i--) {
    if (hour >= PERIODS[i].from) return PERIODS[i].key;
  }
  return PERIODS[0].key;
}

/**
 * 取本地日期字符串（YYYY-MM-DD）
 *
 * 刻意不用 toISOString()：它返回 UTC 日期，会让 UTC+8 的用户在本地 08:00 拿到 UTC 的 00:00，
 * 日期偏前一天，进而让「跨天更换」在错误的时刻发生。
 * @param {Date} [d]
 * @returns {string}
 */
export function getDateStr(d = new Date()) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * 种子 → 无符号整数的哈希：FNV-1a + MurmurHash3 fmix32 雪崩混合
 *
 * 为什么不是裸 FNV-1a：
 *   - 不用 charCodeAt 累加：相邻日期的种子只有末位不同，累加结果差异极小，会连续多天命中同一项；
 *   - 但 FNV-1a 单独用也不够：池长度是 2 的幂（8）时，`% 8` 只用到哈希的**低 3 位**，
 *     而本模块的种子共享长前缀（`2026-10-04greeting.`），只有末尾几个字符不同，
 *     FNV-1a 对这种情况的低位雪崩很弱 —— 实测 dawn/morning/afternoon/evening 四个时段的
 *     低 3 位全部相同（011），导致它们每天取到完全相同的下标、afternoon 与 evening 的
 *     14 天序列一模一样。这不是「有点偏」，是系统性塌缩。
 *   - 因此在 FNV-1a 之后补一轮 fmix32 雪崩，让低位也充分扩散。
 *
 * 用 Math.imul 做 32 位乘法，避免直接相乘造成的浮点精度丢失。
 * @param {string} seed
 * @returns {number}
 */
export function hashSeed(seed) {
  // 第一步：FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // 第二步：fmix32 雪崩（MurmurHash3 终混），保证低位同样均匀
  h ^= h >>> 16;
  h = Math.imul(h, 0x21f0aaad);
  h ^= h >>> 15;
  h = Math.imul(h, 0x735a2d97);
  h ^= h >>> 15;
  return h >>> 0;
}

/**
 * 初始化问候语模块
 * @returns {() => void} 清理函数：停止定时检查并取消语言订阅
 */
export function initGreeting() {
  const el = document.getElementById('greeting');
  if (!el) return () => {};

  // 闸门：记录上一次渲染的身份标识（日期 | 时段键 | 语言）
  let lastToken = '';

  function render() {
    const now = new Date();
    const periodKey = getPeriodKey(now.getHours());
    const dateStr = getDateStr(now);
    // token 必须包含日期：否则一个长期不关闭的标签页在跨天后 token 不变，问候语会僵死在同一句
    const token = `${dateStr}|${periodKey}|${getLanguage()}`;

    // token 未变化 → 直接返回：不计算哈希、不重写 DOM。
    // 定时器每分钟触发一次，若每次都写 textContent 会造成无意义的重排；
    // 更重要的是：同一时段内文案必须钉死，绝不能出现「每分钟在用户眼前跳一次」。
    if (token === lastToken) return;
    lastToken = token;

    const pool = tList(periodKey);
    if (pool.length) {
      // 确定性选取：同一天 + 同一时段 → 固定下标
      const index = hashSeed(dateStr + periodKey) % pool.length;
      el.textContent = pool[index];
    } else {
      // 兜底：池子缺失（语言包未提供数组）时退回单条文案，避免空白
      el.textContent = t(periodKey);
    }
  }

  render();
  // 每分钟检查一次是否跨入新时段 / 跨天
  const timerId = setInterval(render, 60 * 1000);
  const offLanguageChange = onLanguageChange(render);

  return function cleanupGreeting() {
    clearInterval(timerId);
    offLanguageChange();
  };
}
