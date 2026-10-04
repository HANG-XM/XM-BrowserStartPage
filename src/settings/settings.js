/**
 * settings.js —— 设置面板模块
 *
 * 形态：右侧抽屉，宽约 22rem，移动端全屏。
 * 打开：顶栏齿轮按钮 #settings-trigger；关闭：关闭按钮 / 遮罩 / Esc。
 * 各分区通过调用 theme / wallpaper / search / i18n 模块的公开 API 实现。
 */

import { t, getLanguage, setLanguage, onLanguageChange } from '../i18n/index.js?v=20261004';
import { getThemeMode, setThemeMode } from '../core/theme.js?v=20261004';
import {
  getWallpaper,
  setWallpaper,
  setOverlay,
  setBlur,
  SOLID_PRESETS,
  GRADIENT_PRESETS,
} from '../core/wallpaper.js?v=20261004';
import { getSearchEngine, setSearchEngine, ENGINES } from '../core/search.js?v=20261004';
import { storage } from '../storage/storage.js?v=20261004';
import * as wallpaperStore from '../storage/wallpaper-store.js?v=20261004';
import { exportConfig, importConfig, validateBackup, readFileAsJson, APP_VERSION } from '../core/backup.js?v=20261004';
import { showToast } from '../ui/toast.js?v=20261004';

/**
 * 初始化设置面板
 * @returns {() => void} 清理函数
 */
export function initSettings() {
  const trigger = document.getElementById('settings-trigger');
  const panel = document.getElementById('settings-panel');
  const overlay = document.getElementById('settings-overlay');
  const closeBtn = document.getElementById('settings-close');
  const titleEl = document.getElementById('settings-title');
  const bodyEl = document.getElementById('settings-body');
  if (!trigger || !panel || !overlay || !closeBtn || !titleEl || !bodyEl) return () => {};

  let isOpen = false;

  /** 将搜索框透明度写入 CSS 变量（供 .search-box / .engine-menu 使用） */
  function applySearchBoxAlpha(val) {
    const v = val ?? storage.load().searchBoxAlpha ?? 0.65;
    document.documentElement.style.setProperty('--search-box-alpha', v);
  }
  applySearchBoxAlpha(); // 初始化时从配置应用

  // 导入用的隐藏文件选择框（全局复用，仅接受 JSON）
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.className = 'visually-hidden';
  fileInput.setAttribute('aria-label', t('backup.fileInputLabel'));
  document.body.appendChild(fileInput);

  // ----------------------------------------------------------
  // 分区构建（每次 render 全量重建，保持简单）
  // ----------------------------------------------------------

  /** 创建分区容器 */
  function createSection(titleKey) {
    const section = document.createElement('section');
    section.className = 'settings-section';
    const h3 = document.createElement('h3');
    h3.className = 'settings-section-title';
    h3.textContent = t(titleKey);
    section.appendChild(h3);
    return section;
  }

  /** 分段控件（单选按钮组样式） */
  function createSegmented(options, current, onSelect, labelPrefix) {
    const wrap = document.createElement('div');
    wrap.className = 'segmented';
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'segmented-item';
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      btn.setAttribute('aria-pressed', String(opt.value === current));
      if (opt.value === current) btn.classList.add('active');
      btn.addEventListener('click', () => onSelect(opt.value));
      wrap.appendChild(btn);
    });
    if (labelPrefix) {
      const label = document.createElement('div');
      label.className = 'segmented-label';
      label.textContent = labelPrefix;
      wrap.prepend(label);
    }
    return wrap;
  }

  /** 构建外观分区 */
  function buildAppearanceSection() {
    const section = createSection('settings.section.appearance');

    // 主题
    const themeWrap = document.createElement('div');
    themeWrap.className = 'settings-field';
    const themeLabel = document.createElement('span');
    themeLabel.className = 'settings-label';
    themeLabel.textContent = t('theme.toggle');
    themeWrap.appendChild(themeLabel);
    themeWrap.appendChild(
      createSegmented(
        [
          { value: 'light', label: t('settings.theme.light') },
          { value: 'dark', label: t('settings.theme.dark') },
          { value: 'system', label: t('settings.theme.system') },
        ],
        getThemeMode(),
        (val) => {
          setThemeMode(val);
          render(); // 刷新面板内主题选中态
        }
      )
    );
    section.appendChild(themeWrap);

    // 壁纸类型 Tab
    const wp = getWallpaper();
    const wpWrap = document.createElement('div');
    wpWrap.className = 'settings-field';
    const wpLabel = document.createElement('span');
    wpLabel.className = 'settings-label';
    wpLabel.textContent = t('wallpaper.title');
    wpWrap.appendChild(wpLabel);

    const wpTabs = document.createElement('div');
    wpTabs.className = 'wallpaper-tabs';
    const tabKeys = ['solid', 'gradient', 'local'];
    let activeTab = tabKeys.includes(wp.type) ? wp.type : 'solid';
    const idbAvailable = wallpaperStore.isAvailable();
    if (activeTab === 'local' && !idbAvailable) activeTab = 'solid';

    const wpPanels = {};

    function renderWpTabs() {
      wpTabs.innerHTML = '';
      tabKeys.forEach((key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wallpaper-tab';
        btn.textContent = t(`wallpaper.${key}`);
        btn.setAttribute('aria-selected', String(key === activeTab));
        if (key === activeTab) btn.classList.add('active');
        btn.addEventListener('click', () => {
          activeTab = key;
          renderWpPanels();
        });
        wpTabs.appendChild(btn);
      });
    }

    function renderWpPanels() {
      Object.values(wpPanels).forEach((p) => (p.hidden = true));
      if (wpPanels[activeTab]) wpPanels[activeTab].hidden = false;
      renderWpTabs();
    }

    // 纯色面板
    const solidPanel = document.createElement('div');
    solidPanel.className = 'wallpaper-tab-panel';
    const solidGrid = document.createElement('div');
    solidGrid.className = 'swatch-grid';
    SOLID_PRESETS.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = color;
      btn.setAttribute('aria-label', color);
      btn.addEventListener('click', () => {
        setWallpaper({ type: 'solid', value: color });
        renderWpPanels();
        markSwatches();
      });
      btn.dataset.value = color;
      solidGrid.appendChild(btn);
    });
    solidPanel.appendChild(solidGrid);

    const colorRow = document.createElement('label');
    colorRow.className = 'color-picker-row';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = wp.type === 'solid' && wp.value ? wp.value : '#f5f6f8';
    colorInput.addEventListener('input', () => {
      setWallpaper({ type: 'solid', value: colorInput.value });
      markSwatches();
    });
    const colorText = document.createElement('span');
    colorText.textContent = t('wallpaper.customColor');
    colorRow.appendChild(colorInput);
    colorRow.appendChild(colorText);
    solidPanel.appendChild(colorRow);
    wpPanels.solid = solidPanel;

    // 渐变面板
    const gradientPanel = document.createElement('div');
    gradientPanel.className = 'wallpaper-tab-panel';
    const gradientGrid = document.createElement('div');
    gradientGrid.className = 'swatch-grid';
    GRADIENT_PRESETS.forEach((gradient) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = gradient;
      btn.setAttribute('aria-label', gradient);
      btn.dataset.value = gradient;
      btn.addEventListener('click', () => {
        setWallpaper({ type: 'gradient', value: gradient });
        renderWpPanels();
        markSwatches();
      });
      gradientGrid.appendChild(btn);
    });
    gradientPanel.appendChild(gradientGrid);
    wpPanels.gradient = gradientPanel;

    // 本地图片面板
    const localPanel = document.createElement('div');
    localPanel.className = 'wallpaper-tab-panel';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    const chooseBtn = document.createElement('button');
    chooseBtn.type = 'button';
    chooseBtn.className = 'wallpaper-btn';
    chooseBtn.textContent = t('wallpaper.chooseFile');
    chooseBtn.addEventListener('click', () => fileInput.click());
    const previewBox = document.createElement('div');
    previewBox.className = 'wallpaper-preview';
    previewBox.hidden = true;
    const previewImg = document.createElement('img');
    previewBox.appendChild(previewImg);
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'wallpaper-btn primary';
    applyBtn.textContent = t('wallpaper.apply');
    applyBtn.hidden = true;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'wallpaper-btn danger';
    removeBtn.textContent = t('wallpaper.remove');
    removeBtn.hidden = getWallpaper().type !== 'local';
    const hintEl = document.createElement('p');
    hintEl.className = 'wallpaper-hint';
    hintEl.hidden = true;

    let pendingFile = null;
    let previewUrl = null;

    function showHint(text) {
      hintEl.textContent = text;
      hintEl.hidden = false;
      setTimeout(() => {
        hintEl.hidden = true;
      }, 4000);
    }

    function clearPending() {
      pendingFile = null;
      fileInput.value = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      previewBox.hidden = true;
      applyBtn.hidden = true;
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      clearPending();
      pendingFile = file;
      previewUrl = URL.createObjectURL(file);
      previewImg.src = previewUrl;
      previewBox.hidden = false;
      applyBtn.hidden = false;
      if (file.size > 5 * 1024 * 1024) showHint(t('wallpaper.tooLarge'));
    });

    applyBtn.addEventListener('click', async () => {
      if (!pendingFile || !idbAvailable) return;
      try {
        const id = await wallpaperStore.saveImage(pendingFile);
        setWallpaper({ type: 'local', value: id });
        clearPending();
        removeBtn.hidden = false;
      } catch (err) {
        console.error('[settings] 保存壁纸失败：', err);
        showHint(t('wallpaper.loadError'));
      }
    });

    removeBtn.addEventListener('click', async () => {
      const cfg = getWallpaper();
      if (cfg.type !== 'local') return;
      const oldId = cfg.value;
      setWallpaper({ type: 'solid', value: '' });
      if (oldId) {
        try {
          await wallpaperStore.deleteImage(oldId);
        } catch (err) {
          console.error('[settings] 删除壁纸失败：', err);
        }
      }
      removeBtn.hidden = true;
      renderWpPanels();
    });

    if (!idbAvailable) {
      chooseBtn.disabled = true;
      applyBtn.disabled = true;
      chooseBtn.title = t('wallpaper.indexedDBUnavailable');
    }

    const localActions = document.createElement('div');
    localActions.className = 'wallpaper-local-actions';
    localActions.appendChild(chooseBtn);
    localActions.appendChild(applyBtn);
    localActions.appendChild(removeBtn);
    localPanel.appendChild(localActions);
    localPanel.appendChild(previewBox);
    localPanel.appendChild(hintEl);
    wpPanels.local = localPanel;

    wpWrap.appendChild(wpTabs);
    Object.values(wpPanels).forEach((p) => wpWrap.appendChild(p));
    section.appendChild(wpWrap);

    function markSwatches() {
      const cfg = getWallpaper();
      [solidGrid, gradientGrid].forEach((grid) => {
        Array.from(grid.children).forEach((el) => {
          el.classList.toggle('selected', el.dataset.value === cfg.value);
        });
      });
    }

    // 遮罩 / 模糊滑块
    function createSlider(labelKey, min, max, step, value, onInput) {
      const row = document.createElement('div');
      row.className = 'settings-field';
      const label = document.createElement('span');
      label.className = 'settings-label';
      label.textContent = t(labelKey);
      row.appendChild(label);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = value;
      input.addEventListener('input', () => onInput(Number(input.value)));
      row.appendChild(input);
      return row;
    }

    section.appendChild(
      createSlider('wallpaper.overlay', 0, 100, 5, Math.round(wp.overlay * 100), (val) => setOverlay(val / 100))
    );
    section.appendChild(createSlider('wallpaper.blur', 0, 20, 1, wp.blur, (val) => setBlur(val)));

    // 搜索框透明度：滑块为「透明度 0~100」（0=不透明，100=完全透明），
    // 内部换算为 alpha（0~1）后写入 CSS 变量并持久化
    const alphaField = document.createElement('div');
    alphaField.className = 'settings-field';
    const alphaLabel = document.createElement('span');
    alphaLabel.className = 'settings-label';
    alphaLabel.textContent = t('settings.searchOpacity');
    alphaField.appendChild(alphaLabel);
    const alphaRow = document.createElement('div');
    alphaRow.className = 'wallpaper-slider-row';
    const alphaInput = document.createElement('input');
    alphaInput.type = 'range';
    alphaInput.min = '0';
    alphaInput.max = '100';
    alphaInput.step = '1';
    // 存储沿用 alpha（0~1，默认 0.65）；滑块反转为透明度显示
    const initAlpha = storage.load().searchBoxAlpha ?? 0.65;
    const initTransparency = Math.round((1 - initAlpha) * 100);
    alphaInput.value = String(initTransparency);
    const alphaValue = document.createElement('span');
    alphaValue.textContent = initTransparency + '%';
    alphaInput.addEventListener('input', () => {
      const transparency = Number(alphaInput.value); // 0=不透明，100=全透明
      alphaValue.textContent = transparency + '%';
      const alpha = 1 - transparency / 100;
      applySearchBoxAlpha(alpha);
      storage.update({ searchBoxAlpha: alpha });
    });
    alphaRow.appendChild(alphaInput);
    alphaRow.appendChild(alphaValue);
    alphaField.appendChild(alphaRow);
    section.appendChild(alphaField);

    renderWpPanels();
    markSwatches();
    return section;
  }

  /** 构建搜索分区 */
  function buildSearchSection() {
    const section = createSection('settings.section.search');
    const field = document.createElement('div');
    field.className = 'settings-field';
    const label = document.createElement('span');
    label.className = 'settings-label';
    label.textContent = t('settings.engine');
    field.appendChild(label);
    field.appendChild(
      createSegmented(
        ENGINES.map((e) => ({ value: e.id, label: t(`search.engines.${e.id}`) })),
        getSearchEngine(),
        (val) => {
          setSearchEngine(val);
          render();
        }
      )
    );
    section.appendChild(field);
    return section;
  }

  /** 构建语言分区 */
  function buildLanguageSection() {
    const section = createSection('settings.section.language');
    const field = document.createElement('div');
    field.className = 'settings-field';
    field.appendChild(
      createSegmented(
        [
          { value: 'zh-CN', label: t('settings.language.zh') },
          { value: 'en-US', label: t('settings.language.en') },
        ],
        getLanguage(),
        (val) => {
          setLanguage(val);
          // render() 会由 onLanguageChange 订阅者自动触发
        }
      )
    );
    section.appendChild(field);
    return section;
  }

  /** 构建数据分区 */
  function buildDataSection() {
    const section = createSection('settings.section.data');
    const field = document.createElement('div');
    field.className = 'settings-field';

    // 导入：触发隐藏的文件选择框
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'settings-btn';
    importBtn.textContent = t('settings.data.import');
    importBtn.addEventListener('click', () => fileInput.click());

    // 导出：直接下载 JSON
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'settings-btn';
    exportBtn.textContent = t('settings.data.export');
    exportBtn.addEventListener('click', () => {
      const result = exportConfig();
      showToast(result.ok ? t('backup.exportSuccess') : t('backup.exportFailed'),
        result.ok ? 'success' : 'error');
    });

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'settings-btn danger';
    resetBtn.textContent = t('settings.reset');
    resetBtn.addEventListener('click', async () => {
      if (!confirm(t('settings.resetConfirm'))) return;
      try {
        await wallpaperStore.clearAll();
      } catch (err) {
        console.error('[settings] 清空壁纸数据失败：', err);
      }
      storage.clear();
      location.reload();
    });

    const btnRow = document.createElement('div');
    btnRow.className = 'settings-btn-row';
    btnRow.appendChild(importBtn);
    btnRow.appendChild(exportBtn);
    btnRow.appendChild(resetBtn);
    field.appendChild(btnRow);
    section.appendChild(field);
    return section;
  }

  /** 处理导入文件选择 */
  async function handleImportFile() {
    const file = fileInput.files && fileInput.files[0];
    // 重置 input，允许再次选择同一文件
    fileInput.value = '';
    if (!file) return;

    const readResult = await readFileAsJson(file);
    if (!readResult.ok) {
      const keyMap = {
        'too-large': 'backup.importTooLarge',
        'invalid-json': 'backup.importInvalidJson',
      };
      showToast(t(keyMap[readResult.reason] || 'backup.importFailed'), 'error');
      return;
    }

    const check = validateBackup(readResult.json);
    if (!check.ok) {
      showToast(t('backup.importInvalidJson'), 'error');
      return;
    }
    // 高版本提示：允许继续，但先警告
    if (check.warning === 'newer-version') {
      showToast(t('backup.importVersionWarning'), 'warning');
    }

    if (!confirm(t('backup.importConfirm'))) return;

    const result = importConfig(check.payload);
    if (!result.ok) {
      showToast(t('backup.importFailed'), 'error');
      return;
    }
    if (result.wallpaperDiscarded) {
      showToast(t('backup.wallpaperDiscarded'), 'warning');
    } else {
      showToast(t('backup.importSuccess'), 'success');
    }
    // 延迟刷新，让用户看到提示
    setTimeout(() => location.reload(), 800);
  }

  /** 构建关于分区 */
  function buildAboutSection() {
    const section = createSection('settings.section.about');
    const field = document.createElement('div');
    field.className = 'settings-field';
    const name = document.createElement('div');
    name.className = 'settings-about-name';
    name.textContent = 'XM BrowserStartPage';
    const version = document.createElement('div');
    version.className = 'settings-about-version';
    version.textContent = `${t('settings.about.version')} ${APP_VERSION}`;
    const privacy = document.createElement('div');
    privacy.className = 'settings-about-privacy';
    privacy.textContent = t('settings.about.privacy');
    field.appendChild(name);
    field.appendChild(version);
    field.appendChild(privacy);
    section.appendChild(field);
    return section;
  }

  // ----------------------------------------------------------
  // 渲染与显隐
  // ----------------------------------------------------------

  function render() {
    titleEl.textContent = t('settings.title');
    closeBtn.setAttribute('aria-label', t('settings.close'));
    trigger.setAttribute('aria-label', t('settings.open'));
    bodyEl.innerHTML = '';
    bodyEl.appendChild(buildAppearanceSection());
    bodyEl.appendChild(buildSearchSection());
    bodyEl.appendChild(buildLanguageSection());
    bodyEl.appendChild(buildDataSection());
    bodyEl.appendChild(buildAboutSection());
  }

  function openPanel() {
    isOpen = true;
    render();
    panel.hidden = false;
    overlay.hidden = false;
    // 强制重排以触发过渡动画
    void panel.offsetWidth;
    panel.classList.add('open');
    overlay.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('open');
    overlay.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    // 等动画结束后隐藏
    setTimeout(() => {
      if (!isOpen) {
        panel.hidden = true;
        overlay.hidden = true;
      }
    }, 200);
    trigger.focus();
  }

  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }

  // ----------------------------------------------------------
  // 事件绑定
  // ----------------------------------------------------------

  trigger.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', closePanel);
  fileInput.addEventListener('change', handleImportFile);

  function handleKeydown(e) {
    if (isOpen && e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  }
  document.addEventListener('keydown', handleKeydown);

  // 语言切换时重渲染（不关闭面板、不重置滚动）
  const offLanguageChange = onLanguageChange(() => {
    if (isOpen) render();
    // 更新 trigger 的 aria-label
    trigger.setAttribute('aria-label', t('settings.open'));
  });

  render(); // 初始渲染

  return function cleanupSettings() {
    trigger.removeEventListener('click', togglePanel);
    closeBtn.removeEventListener('click', closePanel);
    overlay.removeEventListener('click', closePanel);
    fileInput.removeEventListener('change', handleImportFile);
    fileInput.remove();
    document.removeEventListener('keydown', handleKeydown);
    offLanguageChange();
  };
}
