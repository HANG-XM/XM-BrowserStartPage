/**
 * index.js —— 多语言（i18n）核心
 *
 * 对外能力：
 * - t(key)                   按当前语言取文案，支持 "a.b.c" 点分隔路径
 * - setLanguage(lang)        切换语言并持久化到 localStorage
 * - getLanguage()            获取当前语言代码
 * - getSupportedLanguages()  已注册语言列表（供设置面板渲染选项）
 * - onLanguageChange(fn)     订阅语言切换，返回取消订阅函数
 * - formatDate(date)         按当前语言包模板格式化日期
 *
 * 语言探测优先级：
 *   localStorage 缓存 > navigator.language 精确匹配
 *   > navigator.language 主语言前缀匹配 > 默认语言（zh-CN）
 *
 * 扩展新语言：在 locales/ 下新增语言包文件，并在下方 LOCALES 中登记即可。
 */

import zhCN from './locales/zh-CN.js';
import enUS from './locales/en-US.js';

/** 已注册语言包：语言代码 → 语言包对象 */
const LOCALES = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const DEFAULT_LANG = 'zh-CN';
const LANG_STORAGE_KEY = 'xm-startpage:language';

let currentLang = detectLanguage();
const listeners = new Set();

/** 探测初始语言（优先级见模块注释） */
function detectLanguage() {
  // 1. 用户上次手动选择的语言
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch {
    // 隐私模式等场景读取失败则忽略，继续自动匹配
  }

  // 2. 浏览器语言：先精确匹配（如 zh-CN），再按主语言前缀匹配（如 en-GB → en-US）
  const nav = navigator.language || '';
  if (LOCALES[nav]) return nav;
  const primary = nav.split('-')[0];
  const matched = Object.keys(LOCALES).find((code) => code.split('-')[0] === primary);
  return matched || DEFAULT_LANG;
}

/** 按点分隔路径从语言包中取值，取不到返回 undefined */
function resolve(pack, key) {
  return key.split('.').reduce((obj, k) => (obj == null ? undefined : obj[k]), pack);
}

/**
 * 翻译函数
 * @param {string} key 点分隔的文案键，如 'greeting.morning'
 * @param {object} [params] 参数对象，如 { engine: 'Google' }
 * @returns {string} 对应文案；当前语言缺失时回退默认语言，仍缺失则返回 key 本身
 */
export function t(key, params) {
  const pack = LOCALES[currentLang] || LOCALES[DEFAULT_LANG];
  let value = resolve(pack, key) ?? resolve(LOCALES[DEFAULT_LANG], key);
  if (value == null) return key;
  if (params && typeof value === 'string') {
    value = value.replace(/\{(\w+)\}/g, (_, name) => {
      return params[name] != null ? String(params[name]) : '';
    });
  }
  return value;
}

/** 获取当前语言代码 */
export function getLanguage() {
  return currentLang;
}

/** 获取已支持的语言列表：[{ code, name }] */
export function getSupportedLanguages() {
  return Object.entries(LOCALES).map(([code, pack]) => ({ code, name: pack.meta.name }));
}

/**
 * 切换语言：持久化 + 同步文档元信息 + 通知订阅者
 * @param {string} lang 语言代码，需在 LOCALES 中已注册
 */
export function setLanguage(lang) {
  if (!LOCALES[lang] || lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // 写入失败不影响本次切换
  }
  applyDocumentMeta();
  listeners.forEach((fn) => fn(lang));
}

/**
 * 订阅语言切换
 * @param {(lang: string) => void} fn 语言变更回调
 * @returns {() => void} 取消订阅函数
 */
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 将 <html lang> 与 <title> 同步为当前语言 */
function applyDocumentMeta() {
  document.documentElement.lang = currentLang;
  document.title = t('page.title');
}

/**
 * 按当前语言包的 date.template 格式化日期
 * 支持占位符：{year} {month} {monthName} {day} {weekday}
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function formatDate(date = new Date()) {
  const pack = LOCALES[currentLang] || LOCALES[DEFAULT_LANG];
  const { template, weekdays = [], months = [] } = pack.date;
  return template
    .replace('{weekday}', weekdays[date.getDay()] ?? '')
    .replace('{monthName}', months[date.getMonth()] ?? '')
    .replace('{year}', String(date.getFullYear()))
    .replace('{month}', String(date.getMonth() + 1))
    .replace('{day}', String(date.getDate()));
}

/** 初始化多语言：同步文档元信息。必须先于各渲染模块调用 */
export function initI18n() {
  applyDocumentMeta();
}
