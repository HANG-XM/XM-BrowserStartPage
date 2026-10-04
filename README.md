# XM BrowserStartPage

极简浏览器起始页，用于替代浏览器默认新标签页 / 主页。

## 设计原则

- **本地优先**：所有数据保存在浏览器本地（localStorage + IndexedDB）
- **零外部 API、零后端、零账号**：离线可用，无网络请求
- **纯静态**：原生 HTML + CSS + JavaScript（ES Modules），无框架、无构建工具、无 npm 依赖
- **易于部署**：整个目录即为产物，直接推到 Cloudflare Pages

## 技术栈

原生 HTML5 + CSS3（CSS 变量主题）+ JavaScript（ES Modules），不引入任何第三方库、外部字体、图标库或 CDN 资源。

## 目录结构

```
XM BrowserStartPage/
├── index.html              # 页面骨架：时间区、搜索区、设置入口
├── src/
│   ├── main.js             # 入口：模块装配与初始化
│   ├── styles/
│   │   ├── reset.css       # 基础样式重置
│   │   ├── variables.css   # CSS 变量（亮 / 暗主题、字体、间距、圆角、阴影）
│   │   └── main.css        # 主布局样式（全屏居中、响应式）
│   ├── core/
│   │   ├── clock.js        # 时间与日期模块（占位）
│   │   ├── search.js       # 搜索模块（占位）
│   │   └── greeting.js     # 问候语模块（5 时段文案池 + 日期哈希确定性选取）
│   ├── settings/
│   │   └── settings.js     # 设置面板模块（占位）
│   ├── storage/
│   │   └── storage.js      # localStorage 封装（含 version 迁移预留）
│   └── utils/
│       └── helpers.js      # 通用工具函数（格式化时间、校验 URL）
├── public/
│   └── favicon.ico
└── README.md
```

## 开发说明

由于使用原生 ES Modules，直接双击 `index.html`（file:// 协议）会被浏览器 CORS 策略拦截，需通过任意静态服务器预览，任选其一：

```bash
# Python（无需安装依赖）
python -m http.server 8000

# 或 VS Code 安装 Live Server 扩展后右键 "Open with Live Server"
```

浏览器访问 `http://localhost:8000` 即可。

> 提交前跑一次 `bash scripts/check-imports.sh`，确认所有 import 一致。
>
> 入口资源（index.html 里的 main.js 和 main.css）带 `?v=` 版本号用于缓存失效；子模块的 import 说明符全部为裸路径。
> 这意味着更新部署后，入口会重新下载，但子模块可能命中浏览器缓存。真正解决需要构建工具生成 hash 文件名，本项目坚守零依赖原则，暂不做。
> 如遇更新不生效，请强制刷新（Ctrl+Shift+R）。

## 部署（Cloudflare Pages）

1. 将本目录推送到 GitHub / GitLab 仓库
2. Cloudflare Dashboard → **Pages** → **Create a project** → 连接仓库
3. 构建设置：
   - Framework preset：**None**
   - Build command：**留空**
   - Build output directory：**`/`**（整个仓库即产物）
4. 保存并部署，获得 `*.pages.dev` 域名

## 设为浏览器主页

- Chrome / Edge：设置 → 启动时 → 打开特定网页 → 填入部署后的 URL
- Firefox：设置 → 主页 → 自定义网址
- 替换新标签页需配合浏览器扩展（MVP 之后再评估）

## 功能路线图（MVP）

- [ ] 时间、日期、问候语
- [ ] 搜索框 + 多搜索引擎切换
- [ ] 主题：亮色 / 暗色 / 跟随系统
- [ ] 壁纸：纯色、渐变、本地图片、自定义 URL
- [ ] 设置面板
- [ ] 本地持久化（localStorage + IndexedDB）
- [ ] 导入 / 导出 JSON 配置
- [ ] 响应式布局
