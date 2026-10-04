/**
 * toast.js —— 轻提示组件
 *
 * 用法：showToast(message, type)
 *   type: 'success' | 'warning' | 'error'（默认 'success'）
 *
 * 特点：
 * - 底部居中显示，多个纵向堆叠
 * - 3 秒后自动消失，有过渡动画
 * - 支持 aria-live="polite"，辅助技术可感知
 * - 走 CSS 变量颜色，遵循 prefers-reduced-motion
 */

const DEFAULT_DURATION = 3000; // 显示时长（毫秒）
const TYPE_MAP = { success: 'success', warning: 'warning', error: 'error' };

/** Toast 容器（懒创建，单例） */
let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'true');
  document.body.appendChild(container);
  return container;
}

/**
 * 显示一条 toast
 * @param {string} message 提示文案（如出错，自动回退展示 raw key）
 * @param {'success'|'warning'|'error'} [type='success']
 */
export function showToast(message, type = 'success') {
  const resolved = typeof message === 'string' ? message : String(message);
  const toastType = TYPE_MAP[type] || 'success';

  const el = document.createElement('div');
  el.className = `toast toast--${toastType}`;
  el.textContent = resolved;

  ensureContainer().appendChild(el);

  // 强制重排以触发过渡动画
  void el.offsetWidth;
  el.classList.add('toast--visible');

  const remove = () => {
    el.classList.remove('toast--visible');
    el.addEventListener('transitionend', () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, { once: true });
    // 兜底：过渡事件可能未触发（reduced-motion 时 transition:none）
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  };

  setTimeout(remove, DEFAULT_DURATION);
}
