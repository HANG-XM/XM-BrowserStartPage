/**
 * quick-links.js —— 快速链接模块
 *
 * - 数据保存在 storage.quickLinks：数组，每项 { id, title, url }，最多 8 个
 * - URL 仅允许 http/https；无协议输入自动补 https:// 后再校验
 * - 主页面渲染为一行 <a> 链接（天然进 Tab 序），无数据时容器整体隐藏、不占位
 * - 头像首字符 + hashSeed 选色（颜色值全部来自 variables.css 的 --color-avatar-*）
 * - 设置面板的增删改直接调用本模块 API 后重渲染，立即生效
 */
import { storage } from '../storage/storage.js';
import { t, onLanguageChange } from '../i18n/index.js';
import { hashSeed } from './greeting.js';

/** 快速链接数量上限 */
export const MAX_QUICK_LINKS = 8;
/** 标题长度上限 */
export const MAX_TITLE_LENGTH = 20;
/** 头像调色板长度（对应 variables.css 的 --color-avatar-1 ~ 6） */
const AVATAR_PALETTE_SIZE = 6;

/** 生成稳定唯一 id：优先 randomUUID，不可用时用时间戳 + 随机数 */
function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 规范化 URL：无协议输入自动补 https://；仅接受 http/https 且主机名含点
 * @param {string} input
 * @returns {string|null} 规范化后的 URL；非法返回 null
 */
export function normalizeUrl(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = 'https://' + candidate;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    // 要求主机名含点（"abc" 补全为 https://abc 仍判无效；ftp:// 已在协议层拒绝）
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** 读取当前快速链接（非法数据兜底为空数组，上限截断） */
export function getLinks() {
  const links = storage.load().quickLinks;
  if (!Array.isArray(links)) return [];
  return links
    .filter((l) => l && typeof l.id === 'string' && typeof l.title === 'string' && typeof l.url === 'string')
    .slice(0, MAX_QUICK_LINKS);
}

/**
 * 添加快速链接
 * @param {string} title
 * @param {string} url
 * @returns {{ok:true, link: object} | {ok:false, reason: 'title-required'|'invalid-url'|'limit-reached'}}
 */
export function addLink(title, url) {
  const cleanTitle = String(title ?? '').trim();
  if (!cleanTitle || cleanTitle.length > MAX_TITLE_LENGTH) {
    return { ok: false, reason: 'title-required' };
  }
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return { ok: false, reason: 'invalid-url' };

  const links = getLinks();
  if (links.length >= MAX_QUICK_LINKS) return { ok: false, reason: 'limit-reached' };

  const link = { id: createId(), title: cleanTitle, url: normalizedUrl };
  storage.update({ quickLinks: [...links, link] });
  return { ok: true, link };
}

/**
 * 更新快速链接（标题 / URL）
 * @param {string} id
 * @param {{title?: string, url?: string}} patch
 * @returns {{ok:true, link: object} | {ok:false, reason: 'not-found'|'title-required'|'invalid-url'}}
 */
export function updateLink(id, patch) {
  const links = getLinks();
  const index = links.findIndex((l) => l.id === id);
  if (index === -1) return { ok: false, reason: 'not-found' };

  let nextTitle = links[index].title;
  if (patch.title !== undefined) {
    const cleanTitle = String(patch.title).trim();
    if (!cleanTitle || cleanTitle.length > MAX_TITLE_LENGTH) {
      return { ok: false, reason: 'title-required' };
    }
    nextTitle = cleanTitle;
  }

  let nextUrl = links[index].url;
  if (patch.url !== undefined) {
    const normalizedUrl = normalizeUrl(patch.url);
    if (!normalizedUrl) return { ok: false, reason: 'invalid-url' };
    nextUrl = normalizedUrl;
  }

  const updated = { ...links[index], title: nextTitle, url: nextUrl };
  const next = links.slice();
  next[index] = updated;
  storage.update({ quickLinks: next });
  return { ok: true, link: updated };
}

/** 删除快速链接（不存在等同成功） */
export function removeLink(id) {
  storage.update({ quickLinks: getLinks().filter((l) => l.id !== id) });
}

/** 按标题哈希选取头像调色板下标（0~5） */
export function avatarIndex(title) {
  return hashSeed(String(title)) % AVATAR_PALETTE_SIZE;
}

/**
 * 渲染主页面快速链接：无数据时隐藏整个容器，有数据时重建 <a> 列表
 */
export function renderQuickLinks() {
  const dock = document.getElementById('quicklinks-dock');
  if (!dock) return;

  const links = getLinks();
  dock.innerHTML = '';
  if (links.length === 0) {
    dock.hidden = true; // 添加第一个时移除，删除最后一个时加回
    return;
  }
  dock.hidden = false;

  const frag = document.createDocumentFragment();
  links.forEach((link) => {
    const a = document.createElement('a');
    a.className = 'quicklink-item';
    a.href = link.url;
    a.title = link.title; // 悬停由浏览器显示原生 tooltip，不做自定义组件
    a.setAttribute('aria-label', link.title); // 屏幕阅读器读完整标题（否则只读首字母）

    const avatar = document.createElement('span');
    avatar.className = 'quicklink-avatar';
    // Array.from 按码点取首字符（中文首汉字、英文首字母），避免代理对截断
    avatar.textContent = Array.from(link.title.trim())[0] || '?';
    avatar.style.backgroundColor = `var(--color-avatar-${avatarIndex(link.title) + 1})`;

    a.appendChild(avatar);
    frag.appendChild(a);
  });
  dock.appendChild(frag);
}

/**
 * 初始化快速链接模块
 * @returns {() => void} 清理函数
 */
export function initQuickLinks() {
  const dock = document.getElementById('quicklinks-dock');
  const applyLabel = () => {
    if (dock) dock.setAttribute('aria-label', t('quickLinks.dockLabel'));
  };
  applyLabel();
  const offLanguageChange = onLanguageChange(applyLabel);
  renderQuickLinks();
  return function cleanupQuickLinks() {
    offLanguageChange();
    if (dock) dock.innerHTML = '';
  };
}
