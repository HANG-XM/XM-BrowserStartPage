/**
 * drag-wallpaper.js —— 拖拽图片到页面设为壁纸
 *
 * - window 级监听 dragover / dragleave / drop（壁纸层 z-index 为负，不能作 drop 目标）
 * - dragover 时显示全屏遮罩提示「松开以设为壁纸」
 * - drop 时取第一个图片文件，写入 IndexedDB 后设为本地壁纸
 * - 非图片文件 toast 报错；超大图（>10MB）toast 提示但不阻止
 */
import { t, onLanguageChange } from '../i18n/index.js';
import { showToast } from '../ui/toast.js';
import * as wallpaperStore from '../storage/wallpaper-store.js';
import { setWallpaper } from './wallpaper.js';

export function initDragWallpaper() {
  const overlay = document.getElementById('drop-overlay');
  if (!overlay) return () => {};

  const hintText = overlay.querySelector('.drop-overlay-text');

  // 语言切换时刷新提示文字
  const updateText = () => {
    if (hintText) hintText.textContent = t('wallpaper.dropHint');
  };
  updateText();
  const offLang = onLanguageChange(updateText);

  // dragover：preventDefault 允许 drop，同时显示视觉反馈
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    document.body.classList.add('drop-active');
    overlay.hidden = false;
  }

  // dragleave：relatedTarget 为 null 或坐标出界时视为离开窗口
  // 后备判断兼容 Firefox 边缘场景
  function handleDragLeave(e) {
    if (
      e.relatedTarget === null ||
      (!e.relatedTarget?.closest && e.clientX <= 0 && e.clientY <= 0)
    ) {
      document.body.classList.remove('drop-active');
      overlay.hidden = true;
    }
  }

  // drop：阻止浏览器默认打开文件，处理图片
  async function handleDrop(e) {
    e.preventDefault();
    document.body.classList.remove('drop-active');
    overlay.hidden = true;

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    // 类型校验
    if (!file.type.startsWith('image/')) {
      showToast(t('wallpaper.dropImageOnly'), 'error');
      return;
    }

    // 超大图软提示（不阻止）
    const MB = 1024 * 1024;
    if (file.size > 10 * MB) {
      showToast(t('wallpaper.largeFileHint'), 'warning');
    }

    // 写入 IndexedDB 并设为壁纸
    if (!wallpaperStore.isAvailable()) {
      showToast(t('wallpaper.dropFailed'), 'error');
      return;
    }

    try {
      const id = await wallpaperStore.saveImage(file);
      setWallpaper({ type: 'local', value: id });
      showToast(t('wallpaper.dropSuccess'), 'success');
    } catch (err) {
      console.error('[drag-wallpaper] saveImage failed:', err);
      showToast(t('wallpaper.dropFailed'), 'error');
    }
  }

  window.addEventListener('dragover', handleDragOver);
  window.addEventListener('dragleave', handleDragLeave);
  window.addEventListener('drop', handleDrop);

  return function cleanupDragWallpaper() {
    offLang();
    window.removeEventListener('dragover', handleDragOver);
    window.removeEventListener('dragleave', handleDragLeave);
    window.removeEventListener('drop', handleDrop);
    document.body.classList.remove('drop-active');
    overlay.hidden = true;
  };
}
