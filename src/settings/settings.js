/**
 * settings.js —— 设置面板模块
 *
 * 形态：右侧抽屉，宽约 22rem，移动端全屏。
 * 打开：顶栏齿轮按钮 #settings-trigger；关闭：关闭按钮 / 遮罩 / Esc。
 * 各分区通过调用 theme / wallpaper / search / i18n 模块的公开 API 实现。
 */

import { t, getLanguage, setLanguage, onLanguageChange, getSupportedLanguages } from '../i18n/index.js';
import { getThemeMode, setThemeMode } from '../core/theme.js';
import {
  getWallpaper,
  setWallpaper,
  setOverlay,
  setBlur,
  setDailyRotate,
  SOLID_PRESETS,
  GRADIENT_PRESETS,
} from '../core/wallpaper.js';
import { getSearchEngine, setSearchEngine, ENGINES } from '../core/search.js';
import {
  getLinks, addLink, updateLink, removeLink, avatarIndex,
  renderQuickLinks, MAX_QUICK_LINKS, MAX_TITLE_LENGTH,
} from '../core/quick-links.js';
import { refreshClock } from '../core/clock.js';
import { storage } from '../storage/storage.js';
import * as wallpaperStore from '../storage/wallpaper-store.js';
import { exportConfig, importConfig, validateBackup, readFileAsJson, APP_VERSION } from '../core/backup.js';
import { showToast } from '../ui/toast.js';
import { applyVisibility } from '../core/element-visibility.js';

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

  /** 将搜索框透明度写入 CSS 变量（仅 .search-box 使用；null=未自定义，清除 inline 走 CSS 按主题默认） */
  function applySearchBoxAlpha(transparency) {
    const t = transparency ?? storage.load().searchBoxTransparency;
    if (t == null) {
      document.documentElement.style.removeProperty('--search-box-alpha');
      return;
    }
    const floor = document.documentElement.dataset.theme === 'dark' ? 0.6 : 0.55;
    const alpha = 1 - (t / 100) * (1 - floor);
    document.documentElement.style.setProperty('--search-box-alpha', alpha);
  }
  applySearchBoxAlpha(); // 初始化时从配置应用

  // 首屏不构建面板内容，但齿轮 / 关闭按钮的 aria-label 必须在初始化时设好，
  // 否则 en-US 用户首次打开前会看到 HTML 里硬编码的中文「打开设置 / 关闭设置」
  trigger.setAttribute('aria-label', t('settings.open'));
  closeBtn.setAttribute('aria-label', t('settings.close'));

  // 导入用的隐藏文件选择框（全局复用，仅接受 JSON）
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.className = 'visually-hidden';
  fileInput.tabIndex = -1;
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
  function createSegmented(options, current, onSelect) {
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
    return wrap;
  }

  /**
   * 构建元素显隐开关行（显示问候语 / 显示日期）
   * @param {string} labelKey i18n 文案 key
   * @param {string} configKey storage 配置字段名
   */
  function buildVisibilityToggle(labelKey, configKey) {
    const field = document.createElement('div');
    field.className = 'settings-field';
    const row = document.createElement('label');
    row.className = 'settings-toggle-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'settings-toggle';
    checkbox.checked = storage.load()[configKey] !== false;

    const text = document.createElement('span');
    text.className = 'settings-toggle-text';
    text.textContent = t(labelKey);

    row.appendChild(checkbox);
    row.appendChild(text);
    field.appendChild(row);
    // 切换不触发 render：持久化后立即应用显隐，焦点保持在开关上
    checkbox.addEventListener('change', () => {
      storage.update({ [configKey]: checkbox.checked });
      applyVisibility();
    });
    return field;
  }

  /** 构建「显示秒数」开关行 */
  function buildShowSecondsToggle() {
    const field = document.createElement('div');
    field.className = 'settings-field';
    const row = document.createElement('label');
    row.className = 'settings-toggle-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'settings-toggle';
    checkbox.checked = storage.load().showSeconds === true;

    const text = document.createElement('span');
    text.className = 'settings-toggle-text';
    text.textContent = t('settings.showSeconds');

    row.appendChild(checkbox);
    row.appendChild(text);
    field.appendChild(row);
    // 切换不触发 render：持久化后 refreshClock 立即重绘，焦点保持在开关上
    checkbox.addEventListener('change', () => {
      storage.update({ showSeconds: checkbox.checked });
      refreshClock();
    });
    return field;
  }

  /** 构建「关闭玻璃模糊」开关行 */
  function buildNoBlurToggle() {
    const field = document.createElement('div');
    field.className = 'settings-field';
    const row = document.createElement('label');
    row.className = 'settings-toggle-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'settings-toggle';
    checkbox.checked = storage.load().noBlur === true;

    const text = document.createElement('span');
    text.className = 'settings-toggle-text';
    text.textContent = t('settings.noBlur');

    row.appendChild(checkbox);
    row.appendChild(text);
    field.appendChild(row);
    // 切换不 render 面板：持久化后立即切换 html.no-blur 类，焦点保持在开关
    checkbox.addEventListener('change', () => {
      storage.update({ noBlur: checkbox.checked });
      document.documentElement.classList.toggle('no-blur', checkbox.checked);
    });
    return field;
  }

  /** 构建「每日更换壁纸」开关行（含说明文字） */
  function buildDailyWallpaperToggle() {
    const field = document.createElement('div');
    field.className = 'settings-field';
    const row = document.createElement('label');
    row.className = 'settings-toggle-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'settings-toggle';
    checkbox.checked = storage.load().wallpaperDailyRotate === true;

    const text = document.createElement('span');
    text.className = 'settings-toggle-text';
    text.textContent = t('settings.dailyWallpaper');

    row.appendChild(checkbox);
    row.appendChild(text);
    field.appendChild(row);

    const hint = document.createElement('div');
    hint.className = 'settings-toggle-hint';
    hint.textContent = t('settings.dailyWallpaperHint');
    field.appendChild(hint);

    // 切换不 render 面板：setDailyRotate 内部持久化并重新应用壁纸，焦点保持在开关
    checkbox.addEventListener('change', () => {
      setDailyRotate(checkbox.checked);
    });
    return field;
  }

  /** 构建外观分区 */
  function buildAppearanceSection() {
    const section = createSection('settings.section.appearance');

    // 主题
    const themeWrap = document.createElement('div');
    themeWrap.className = 'settings-field';
    const themeLabel = document.createElement('span');
    themeLabel.className = 'settings-label';
    themeLabel.textContent = t('settings.themeLabel');
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

    // 时间格式
    const hourWrap = document.createElement('div');
    hourWrap.className = 'settings-field';
    const hourLabel = document.createElement('span');
    hourLabel.className = 'settings-label';
    hourLabel.textContent = t('settings.hourFormat');
    hourWrap.appendChild(hourLabel);
    hourWrap.appendChild(
      createSegmented(
        [
          { value: 'auto', label: t('settings.hourFormatAuto') },
          { value: '12', label: t('settings.hourFormat12') },
          { value: '24', label: t('settings.hourFormat24') },
        ],
        storage.load().hourFormat,
        (val) => {
          storage.update({ hourFormat: val });
          refreshClock();      // 立即重读制式并补帧
          render();           // 刷新 segmented 选中态（焦点由 render 恢复到按钮）
        }
      )
    );
    section.appendChild(hourWrap);

    // N4：显示秒数开关（放在制式之后、显隐之前）
    section.appendChild(buildShowSecondsToggle());
    // 手动关闭玻璃模糊
    section.appendChild(buildNoBlurToggle());

    // 显示问候语 / 显示日期开关
    section.appendChild(buildVisibilityToggle('settings.showGreeting', 'showGreeting'));
    section.appendChild(buildVisibilityToggle('settings.showDate', 'showDate'));

    // 每日更换壁纸开关（含说明文字）
    section.appendChild(buildDailyWallpaperToggle());

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
    wpTabs.setAttribute('role', 'group');
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
        btn.setAttribute('aria-pressed', String(key === activeTab));
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
    // 「无壁纸」格（首位）：清空背景，透出主题底色
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'swatch swatch--none';
    noneBtn.dataset.value = '';
    noneBtn.setAttribute('aria-label', t('settings.wallpaper.none'));
    noneBtn.addEventListener('click', () => {
      setWallpaper({ type: 'solid', value: '' });
      renderWpPanels();
      markSwatches();
    });
    solidGrid.appendChild(noneBtn);
    SOLID_PRESETS.forEach((color, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = color;
      // 顺序与 SOLID_PRESETS 数组严格对应
      btn.setAttribute('aria-label', t(`settings.colorPreset.${index}`));
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
    colorInput.setAttribute('aria-label', t('settings.customColorLabel'));
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
    GRADIENT_PRESETS.forEach((gradient, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.background = gradient;
      // 顺序与 GRADIENT_PRESETS 数组严格对应
      btn.setAttribute('aria-label', t(`settings.gradientPreset.${index}`));
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
    fileInput.tabIndex = -1;
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

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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
      if (file.size > MAX_IMAGE_SIZE) {
        showHint(t('wallpaper.tooLarge'));
        // 继续应用，不阻止
      }
      pendingFile = file;
      previewUrl = URL.createObjectURL(file);
      previewImg.src = previewUrl;
      previewBox.hidden = false;
      applyBtn.hidden = false;
      applyBtn.disabled = false;
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
    // 内部按主题地板值换算为 alpha 后写入 CSS 变量，防抖 300ms 后持久化
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
    // 存储为透明度（0~100，默认 65）；滑块值与存储语义一致
    const initTransparency = storage.load().searchBoxTransparency ?? 65;
    alphaInput.value = String(initTransparency);
    const alphaValue = document.createElement('span');
    alphaValue.textContent = initTransparency + '%';
    let alphaSaveTimer = null;
    alphaInput.addEventListener('input', () => {
      const transparency = Number(alphaInput.value); // 0=不透明，100=全透明
      alphaValue.textContent = transparency + '%';
      applySearchBoxAlpha(transparency);
      // 防抖写盘
      if (alphaSaveTimer) clearTimeout(alphaSaveTimer);
      alphaSaveTimer = setTimeout(() => {
        storage.update({ searchBoxTransparency: transparency });
      }, 300);
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
    // 引擎 4 项中英文混排宽度不均，抽屉内用 2×2 网格（其余 segmented 保持单行）
    const engineSeg = createSegmented(
      ENGINES.map((e) => ({ value: e.id, label: t(`search.engines.${e.id}`) })),
      getSearchEngine(),
      (val) => {
        setSearchEngine(val);
        render();
      }
    );
    engineSeg.classList.add('segmented--search-engine');
    field.appendChild(engineSeg);
    section.appendChild(field);

    // 搜索结果打开方式：新标签页 / 当前页
    const openInField = document.createElement('div');
    openInField.className = 'settings-field';
    const openInLabel = document.createElement('span');
    openInLabel.className = 'settings-label';
    openInLabel.textContent = t('settings.searchOpenIn');
    openInField.appendChild(openInLabel);
    openInField.appendChild(
      createSegmented(
        [
          { value: 'new', label: t('settings.searchOpenInNew') },
          { value: 'current', label: t('settings.searchOpenInCurrent') },
        ],
        storage.load().searchOpenIn === 'current' ? 'current' : 'new',
        (val) => {
          storage.update({ searchOpenIn: val });
          render(); // 刷新选中态，焦点由 render 恢复到该按钮
        }
      )
    );
    section.appendChild(openInField);

    // 自动聚焦搜索框开关
    const focusField = document.createElement('div');
    focusField.className = 'settings-field';
    const focusRow = document.createElement('label');
    focusRow.className = 'settings-toggle-row';
    const focusCheckbox = document.createElement('input');
    focusCheckbox.type = 'checkbox';
    focusCheckbox.className = 'settings-toggle';
    focusCheckbox.checked = storage.load().autoFocus !== false;
    const focusText = document.createElement('span');
    focusText.className = 'settings-toggle-text';
    focusText.textContent = t('settings.autoFocus');
    focusRow.appendChild(focusCheckbox);
    focusRow.appendChild(focusText);
    focusField.appendChild(focusRow);
    const focusHint = document.createElement('div');
    focusHint.className = 'settings-toggle-hint';
    focusHint.textContent = t('settings.autoFocusHint');
    focusField.appendChild(focusHint);
    // 切换不触发 render：仅持久化，焦点保持在开关上
    focusCheckbox.addEventListener('change', () => {
      storage.update({ autoFocus: focusCheckbox.checked });
    });
    section.appendChild(focusField);

    return section;
  }

  /** 构建语言分区 */
  function buildLanguageSection() {
    const section = createSection('settings.section.language');
    const field = document.createElement('div');
    field.className = 'settings-field';
    field.appendChild(
      createSegmented(
        getSupportedLanguages().map(({ code, name }) => ({ value: code, label: name })),
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
      const reasonKeyMap = {
        'invalid-schema': 'backup.importInvalidSchema',
        'invalid-data': 'backup.importInvalidSchema',
        'invalid-json': 'backup.importInvalidJson',
        'too-large': 'backup.importTooLarge',
      };
      const key = reasonKeyMap[check.reason] || 'backup.importFailed';
      console.warn('[settings] 导入校验失败，原因：', check.reason);
      showToast(t(key), 'error');
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

  /** 构建一个快速链接展示行（头像 + 标题 + 编辑/删除） */
  function createLinkItemRow(link) {
    const row = document.createElement('div');
    row.className = 'ql-item-row';

    const avatar = document.createElement('span');
    avatar.className = 'ql-item-avatar';
    avatar.textContent = Array.from(link.title.trim())[0] || '?';
    avatar.style.backgroundColor = `var(--color-avatar-${avatarIndex(link.title) + 1})`;

    const title = document.createElement('span');
    title.className = 'ql-item-title';
    title.textContent = link.title;

    const actions = document.createElement('span');
    actions.className = 'ql-item-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ql-icon-btn';
    editBtn.textContent = t('settings.quickLinks.edit');
    editBtn.addEventListener('click', () => enterLinkEditMode(row, link));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'ql-icon-btn';
    delBtn.textContent = t('settings.quickLinks.delete');
    delBtn.addEventListener('click', () => {
      removeLink(link.id);
      renderQuickLinks();
      render();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(avatar);
    row.appendChild(title);
    row.appendChild(actions);
    return row;
  }

  /** 进入 inline 编辑：当前行替换为标题/URL 输入框 + 保存/取消 */
  function enterLinkEditMode(row, link) {
    row.classList.add('editing');
    row.innerHTML = '';
    const form = document.createElement('div');
    form.className = 'ql-form';

    const titleInput = document.createElement('input');
    titleInput.className = 'ql-input';
    titleInput.type = 'text';
    titleInput.maxLength = String(MAX_TITLE_LENGTH);
    titleInput.value = link.title;
    titleInput.placeholder = t('settings.quickLinks.namePlaceholder');

    const urlInput = document.createElement('input');
    urlInput.className = 'ql-input';
    urlInput.type = 'text';
    urlInput.value = link.url;
    urlInput.placeholder = t('settings.quickLinks.urlPlaceholder');

    const actions = document.createElement('div');
    actions.className = 'ql-form-actions';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'settings-btn';
    saveBtn.textContent = t('settings.quickLinks.save');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'settings-btn';
    cancelBtn.textContent = t('settings.quickLinks.cancel');

    // 取消：放弃编辑，整面板重绘恢复原行
    function cancelEdit() {
      render();
    }

    function saveEdit() {
      const result = updateLink(link.id, { title: titleInput.value, url: urlInput.value });
      if (!result.ok) {
        const reasonMap = {
          'title-required': 'settings.quickLinks.titleRequired',
          'invalid-url': 'settings.quickLinks.invalidUrl',
        };
        showToast(t(reasonMap[result.reason] || 'backup.importFailed'), 'error');
        return;
      }
      renderQuickLinks();
      render();
    }
    saveBtn.addEventListener('click', saveEdit);
    cancelBtn.addEventListener('click', cancelEdit);

    // Enter：标题框跳到 URL，URL 框保存（与添加表单行为对齐）
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        urlInput.focus();
      }
    });
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      }
    });

    // Esc = 取消（面板级捕获监听会跳过 .editing 行，由这里处理）
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cancelEdit();
      }
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(titleInput);
    form.appendChild(urlInput);
    form.appendChild(actions);
    row.appendChild(form);
    titleInput.focus();
  }

  /** 构建底部添加表单 */
  function createLinkAddForm() {
    const form = document.createElement('div');
    form.className = 'ql-form';

    const titleInput = document.createElement('input');
    titleInput.className = 'ql-input';
    titleInput.type = 'text';
    titleInput.maxLength = String(MAX_TITLE_LENGTH);
    titleInput.placeholder = t('settings.quickLinks.namePlaceholder');

    const urlInput = document.createElement('input');
    urlInput.className = 'ql-input';
    urlInput.type = 'text';
    urlInput.placeholder = t('settings.quickLinks.urlPlaceholder');

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'settings-btn';
    addBtn.textContent = t('settings.quickLinks.add');

    function doAdd() {
      const result = addLink(titleInput.value, urlInput.value);
      if (!result.ok) {
        const reasonMap = {
          'title-required': 'settings.quickLinks.titleRequired',
          'invalid-url': 'settings.quickLinks.invalidUrl',
          'limit-reached': 'settings.quickLinks.limitReached',
        };
        showToast(t(reasonMap[result.reason] || 'backup.importFailed'), 'error');
        return;
      }
      renderQuickLinks();
      render();
    }
    addBtn.addEventListener('click', doAdd);
    // 输入框内 Enter：标题框跳 URL，URL 框执行添加
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); urlInput.focus(); }
    });
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
    });

    const actions = document.createElement('div');
    actions.className = 'ql-form-actions';
    actions.appendChild(addBtn);
    form.appendChild(titleInput);
    form.appendChild(urlInput);
    form.appendChild(actions);
    return form;
  }

  /** 构建快速链接管理分区 */
  function buildQuickLinksSection() {
    const section = createSection('settings.quickLinks.title');

    const hint = document.createElement('div');
    hint.className = 'ql-hint';
    hint.textContent = t('settings.quickLinks.max');
    section.appendChild(hint);

    const listWrap = document.createElement('div');
    listWrap.className = 'ql-list';
    const links = getLinks();
    if (links.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ql-empty';
      empty.textContent = t('settings.quickLinks.empty');
      listWrap.appendChild(empty);
    } else {
      links.forEach((link) => listWrap.appendChild(createLinkItemRow(link)));
    }
    section.appendChild(listWrap);

    // 达上限时不显示添加表单，改显示提示
    if (links.length >= MAX_QUICK_LINKS) {
      const limitNote = document.createElement('div');
      limitNote.className = 'ql-empty';
      limitNote.textContent = t('settings.quickLinks.limitReached');
      section.appendChild(limitNote);
    } else {
      section.appendChild(createLinkAddForm());
    }
    return section;
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

  /** 记录面板滚动位置（全量重建前） */
  function captureScroll() {
    return bodyEl.scrollTop;
  }

  /** 重建后恢复滚动位置，并夹取到内容实际可滚动范围 */
  function restoreScroll(top) {
    if (typeof top !== 'number') return;
    const maxScroll = bodyEl.scrollHeight - bodyEl.clientHeight;
    bodyEl.scrollTop = Math.min(top, Math.max(0, maxScroll));
  }

  /** 记录当前焦点信息（data-value 或 aria-label） */
  function captureFocus() {
    const el = document.activeElement;
    if (!el || !bodyEl.contains(el)) return null;
    const dataValue = el.dataset && el.dataset.value;
    if (dataValue) return { key: 'data-value', value: dataValue };
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return { key: 'aria-label', value: ariaLabel };
    return null;
  }

  /** 重建后按标识恢复焦点（遍历比较，不用 CSS.escape） */
  function restoreFocus(info) {
    if (!info) return;
    const candidates = bodyEl.querySelectorAll('[' + info.key + ']');
    for (const el of candidates) {
      if (el.getAttribute(info.key) === info.value) {
        if (typeof el.focus === 'function') el.focus();
        return;
      }
    }
  }

  function render() {
    const prevFocus = captureFocus();
    const prevScroll = captureScroll();
    titleEl.textContent = t('settings.title');
    closeBtn.setAttribute('aria-label', t('settings.close'));
    trigger.setAttribute('aria-label', t('settings.open'));
    bodyEl.innerHTML = '';
    bodyEl.appendChild(buildAppearanceSection());
    bodyEl.appendChild(buildQuickLinksSection());
    bodyEl.appendChild(buildSearchSection());
    bodyEl.appendChild(buildLanguageSection());
    bodyEl.appendChild(buildDataSection());
    bodyEl.appendChild(buildAboutSection());
    restoreFocus(prevFocus);
    restoreScroll(prevScroll);
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
    // 等面板滑出动画播完后再 hidden（--transition-normal = 300ms）
    setTimeout(() => {
      if (!isOpen) {
        panel.hidden = true;
        overlay.hidden = true;
      }
    }, 300);
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

  /** 收集面板内所有可聚焦且可见的元素（一次性收集，避免重复 getComputedStyle） */
  function getFocusableElements() {
    const candidates = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(candidates).filter((el) => {
      if (el.disabled) return false;
      if (el.checkVisibility) return el.checkVisibility();
      // 退化：检查 display/visibility + position !== 'fixed'
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.position !== 'fixed';
    });
  }

  function handleKeydown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      // 快速链接 inline 编辑行内的 Esc 只取消编辑（行内监听随后处理），不关闭面板
      if (e.target && e.target.closest && e.target.closest('.ql-item-row.editing')) return;
      e.preventDefault();
      closePanel();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = getFocusableElements();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      // 焦点不在面板内时，强制拉回第一个
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }
  // 用捕获阶段注册，确保在浏览器默认焦点移动前拦截 Tab
  document.addEventListener('keydown', handleKeydown, true);

  // 语言切换时重渲染（不关闭面板，恢复滚动位置）
  const offLanguageChange = onLanguageChange(() => {
    if (isOpen) render();
    // 更新 trigger 的 aria-label
    trigger.setAttribute('aria-label', t('settings.open'));
  });

  // 主题切换时重算搜索框 alpha（地板值不同；null 直传 → 清除 inline 走 CSS 按主题默认）
  const themeObserver = new MutationObserver(() => {
    applySearchBoxAlpha(storage.load().searchBoxTransparency);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  return function cleanupSettings() {
    trigger.removeEventListener('click', togglePanel);
    closeBtn.removeEventListener('click', closePanel);
    overlay.removeEventListener('click', closePanel);
    fileInput.removeEventListener('change', handleImportFile);
    fileInput.remove();
    document.removeEventListener('keydown', handleKeydown, true);
    themeObserver.disconnect();
    offLanguageChange();
  };
}
