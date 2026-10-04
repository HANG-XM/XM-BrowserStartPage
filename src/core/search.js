/**
 * search.js —— 搜索模块
 *
 * 核心能力：
 * - 内置四个搜索引擎（google / bing / yandex / baidu）
 * - 输入内容自动判断为 URL（直接跳转）或关键词（用搜索引擎查询）
 * - 引擎切换通过搜索框旁的胶囊按钮 + 下拉菜单完成
 * - 全局快捷键：/ 或 Ctrl/Cmd+K 聚焦搜索框，Ctrl/Cmd+1~4 切引擎
 * - 配置持久化到 storage
 */

import { t, onLanguageChange } from '../i18n/index.js';
import { storage } from '../storage/storage.js';

// ============================================================
// 引擎定义
// ============================================================

/** 搜索引擎列表（顺序即 Ctrl+1/2/3/4 对应顺序），供设置面板复用 */
export const ENGINES = [
  {
    id: 'google',
    url: 'https://www.google.com/search?q={query}',
    icon: 'G',
  },
  {
    id: 'bing',
    url: 'https://www.bing.com/search?q={query}',
    icon: 'b',
  },
  {
    id: 'yandex',
    url: 'https://yandex.com/search/?text={query}',
    icon: 'Y',
  },
  {
    id: 'baidu',
    url: 'https://www.baidu.com/s?wd={query}',
    icon: 'B',
  },
];

/** 引擎 ID → 引擎对象的索引，方便 O(1) 查找 */
const ENGINE_MAP = new Map(ENGINES.map((e) => [e.id, e]));

// ============================================================
// 公共 API（不依赖 DOM，可被测试直接调用）
// ============================================================

/** 获取当前搜索引擎 ID */
export function getSearchEngine() {
  const id = storage.load().searchEngine;
  return ENGINE_MAP.has(id) ? id : ENGINES[0].id;
}

/** 设置当前搜索引擎 */
export function setSearchEngine(id) {
  if (!ENGINE_MAP.has(id)) return;
  storage.update({ searchEngine: id });
}

/**
 * 构建搜索 URL
 * @param {string} query 搜索关键词
 * @param {string} [engineId] 引擎 ID，不传则用当前引擎
 * @returns {string} 完整的搜索引擎结果页 URL
 */
export function buildSearchUrl(query, engineId = getSearchEngine()) {
  const engine = ENGINE_MAP.get(engineId) || ENGINES[0];
  return engine.url.replace('{query}', encodeURIComponent(query));
}

/** 常见顶级域名后缀（用于判断输入是否为域名） */
const COMMON_TLDS = new Set([
  'com', 'cn', 'net', 'org', 'io', 'dev', 'app', 'co', 'me',
  'info', 'cc', 'top', 'xyz', 'tv', 'fm', 'im', 'us', 'uk',
  'jp', 'kr', 'de', 'fr', 'ru', 'in', 'br', 'au', 'hk', 'tw',
]);

/**
 * 判断输入是否“像”一个 URL（应直接跳转而非搜索）
 * @param {string} input
 * @returns {boolean}
 */
export function isUrlLike(input) {
  const trimmed = input.trim();
  if (!trimmed) return false;
  // 含空格 → 不是 URL
  if (/\s/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  // 已有协议
  if (/^https?:\/\//.test(lower)) return true;
  // 以 www. 开头
  if (/^www\./.test(lower)) return true;
  // localhost / 局域网 IP / 公网 IP（可带端口）
  if (/^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(trimmed)) return true;
  // 匹配 x.x.tld 或 x.tld 格式（域名含点 + 常见后缀）
  const match = lower.match(/\b([a-z0-9-]+\.)+([a-z]{2,})(:\d+)?$/);
  if (match) {
    const tld = match[2];
    if (COMMON_TLDS.has(tld)) return true;
  }
  return false;
}

/**
 * 给无协议头的地址补 https://
 * @param {string} input
 * @returns {string}
 */
export function normalizeUrl(input) {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

/**
 * 解析用户输入，决定是跳转还是搜索
 * @param {string} input
 * @returns {{ type: 'url' | 'search', url: string }}
 */
export function resolveInput(input) {
  if (isUrlLike(input)) {
    return { type: 'url', url: normalizeUrl(input) };
  }
  return { type: 'search', url: buildSearchUrl(input) };
}

// ============================================================
// 初始化：DOM 事件与交互
// ============================================================

/**
 * 初始化搜索模块
 * @returns {() => void} 清理函数
 */
export function initSearch() {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const toggle = document.getElementById('engine-toggle');
  const menu = document.getElementById('engine-menu');
  if (!form || !input || !toggle || !menu) return () => {};

  let currentEngineId = getSearchEngine();
  let isMenuOpen = false;
  let focusIndex = -1; // 下拉菜单中当前键盘焦点索引

  // ----------------------------------------------------------
  // 渲染
  // ----------------------------------------------------------

  /** 更新引擎按钮显示、输入框 placeholder、菜单高亮 */
  function render() {
    const engine = ENGINE_MAP.get(currentEngineId) || ENGINES[0];
    const engineName = t(`search.engines.${engine.id}`);
    toggle.innerHTML = `<span class="engine-icon">${engine.icon}</span>`;
    toggle.setAttribute('aria-label', t('search.engineMenu', { engine: engineName }));
    input.placeholder = t('search.placeholder', { engine: engineName });
    input.setAttribute('aria-label', t('search.inputLabel', { engine: engineName }));

    // 更新菜单项 aria-selected
    Array.from(menu.children).forEach((item, idx) => {
      const isSelected = ENGINES[idx].id === currentEngineId;
      item.setAttribute('aria-selected', String(isSelected));
      item.classList.toggle('selected', isSelected);
    });
  }

  /** 构建下拉菜单 DOM */
  function buildMenu() {
    menu.innerHTML = '';
    ENGINES.forEach((engine, index) => {
      const item = document.createElement('button');
      item.className = 'engine-menu-item';
      item.type = 'button';
      item.role = 'option';
      item.setAttribute('data-engine', engine.id);
      item.innerHTML = `<span class="engine-icon">${engine.icon}</span><span class="engine-name">${t(`search.engines.${engine.id}`)}</span><span class="engine-menu-shortcut">${index + 1}</span>`;
      item.addEventListener('click', () => selectEngine(engine.id));
      menu.appendChild(item);
    });
  }

  /** 选中某个引擎 */
  function selectEngine(id) {
    if (id === currentEngineId) {
      closeMenu();
      input.focus();
      return;
    }
    currentEngineId = id;
    setSearchEngine(id);
    render();
    closeMenu();
    input.focus();
  }

  // ----------------------------------------------------------
  // 下拉菜单显隐
  // ----------------------------------------------------------

  function openMenu() {
    isMenuOpen = true;
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    focusIndex = ENGINES.findIndex((e) => e.id === currentEngineId);
    moveFocusInMenu(0);
  }

  function closeMenu() {
    isMenuOpen = false;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    focusIndex = -1;
  }

  function toggleMenu() {
    if (isMenuOpen) closeMenu();
    else openMenu();
  }

  /** 在下拉菜单项之间移动键盘焦点 */
  function moveFocusInMenu(delta) {
    const items = Array.from(menu.children);
    if (!items.length) return;
    focusIndex = (focusIndex + delta + items.length) % items.length;
    items[focusIndex].focus();
  }

  // ----------------------------------------------------------
  // 表单提交
  // ----------------------------------------------------------

  function handleSubmit(e) {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    const result = resolveInput(value);
    window.location.href = result.url;
  }

  // ----------------------------------------------------------
  // 事件处理
  // ----------------------------------------------------------

  toggle.addEventListener('click', toggleMenu);
  form.addEventListener('submit', handleSubmit);

  /** 点击菜单外部关闭 */
  function handleDocumentClick(e) {
    if (!isMenuOpen) return;
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      closeMenu();
    }
  }
  document.addEventListener('click', handleDocumentClick);

  /** 键盘导航：Esc 关闭菜单；方向键上下切换；Enter 选中 */
  function handleKeydown(e) {
    if (!isMenuOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
      toggle.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocusInMenu(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocusInMenu(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const items = Array.from(menu.children);
      if (focusIndex >= 0 && items[focusIndex]) {
        items[focusIndex].click();
      }
      return;
    }
  }
  menu.addEventListener('keydown', handleKeydown);

  // ----------------------------------------------------------
  // 全局快捷键
  // ----------------------------------------------------------

  /** 检测当前焦点是否在可输入元素上 */
  function isTypingContext() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  }

  function handleGlobalKeydown(e) {
    // / 聚焦搜索框（非输入状态下）
    if (e.key === '/' && !isTypingContext()) {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }
    // Ctrl/Cmd + K 聚焦搜索框
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }
    // Ctrl/Cmd + 1~4 切换引擎（输入框内不触发数字切引擎，避免误操作）
    if ((e.ctrlKey || e.metaKey) && /^[1-4]$/.test(e.key) && !isTypingContext()) {
      e.preventDefault();
      const idx = parseInt(e.key, 10) - 1;
      if (ENGINES[idx]) selectEngine(ENGINES[idx].id);
      return;
    }
  }
  document.addEventListener('keydown', handleGlobalKeydown);

  // ----------------------------------------------------------
  // 自动聚焦（页面加载后聚焦输入框）
  // ----------------------------------------------------------
  // 使用 requestAnimationFrame 确保 DOM 已稳定
  requestAnimationFrame(() => {
    input.focus();
  });

  // ----------------------------------------------------------
  // 初始化
  // ----------------------------------------------------------
  buildMenu();
  render();

  // 语言切换时刷新文案
  const offLanguageChange = onLanguageChange(() => {
    buildMenu();
    render();
  });

  return function cleanupSearch() {
    toggle.removeEventListener('click', toggleMenu);
    form.removeEventListener('submit', handleSubmit);
    document.removeEventListener('click', handleDocumentClick);
    menu.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('keydown', handleGlobalKeydown);
    offLanguageChange();
  };
}
