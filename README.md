# 楚汉棋社

可通过邀请链接进入的中国象棋好友对战网页。无需注册，匿名座位身份由 HttpOnly Cookie 保存，棋局存于 D1。两位玩家入座后开始，后续访客以观战身份进入。

## 已实现

- 未开局时显示独立的首页：好友对弈、人机对弈与随手推演入口；手机尽量一屏呈现，进入棋局后再显示棋盘与对局工具。
- 中国象棋合法走棋、将军、将死、困毙、超时判负。
- 任意一方无限撤回最近一步，无需另一方确认；恢复棋子、吃子、轮次和该步开始时的用时。终局后仍可悔棋。
- 提和、认输、双方同意重新开局并交换红黑。
- 不限时或每方 10 / 20 / 30 分钟，服务器裁决时钟。
- 逐步棋谱、历史回看、从任意局面独立推演、棋谱文本导出。
- 翻转棋盘、合法落点提示、落子音效、聊天、称呼修改、在线状态、刷新恢复。
- 手机对局固定在一个可视屏幕内，键盘弹出时自动调整高度；底栏为菜单、棋谱、聊天框、推演。
- 电脑与横屏 iPad：棋盘占满屏幕高度，双方信息、棋谱与聊天、全部操作集中在右侧一栏，整页无需滚动；竖屏 iPad 沿用手机的底栏与抽屉，棋盘随屏幕放大。人机棋室同样如此。
- 界面只保留必要文字：不再有页脚、口号、副标题和功能小注；翻转棋盘、音效在页头（手机在菜单里）。
- 棋谱与聊天记录从底部窗口打开；新聊天在发送方头像旁显示 12 秒气泡。
- 终局时棋盘略微缩小，出现「再来一局」「再蒸一下」「复盘」；收到重开邀请时显示「应邀出战」。
- 「再蒸一下」与菜单悔棋均直接撤回最近一步并继续，非己方回合点击棋盘静默忽略。
- 终局后点「复盘」打开与人机对局相同的完整复盘页（局势图、分析讲解、报告、练习），返回后回到原棋室，可继续再来一局。
- 棋子使用自托管的 Ma Shan Zheng 字体子集，車字统一。字体来源：Google Fonts，授权见 public/fonts/OFL-MaShanZheng.txt。
- 落子声取自 Freesound 上 JJTaynos 的 CC0 录音，出处与处理方式见 public/sounds/SOURCE.md；吃子、将军、绝杀在它之外用 Web Audio 合成，「吃」「将军」使用设备自带的中文语音。
- 走棋时棋子起落并按距离调整滑行时间，吃子时被吃棋子先被压住再碎裂消散，悔棋吃子会让棋子回到盘上；将军有刀光与棋盘微颤，绝杀有毛笔落字、涟漪、火星与印章。分开的落子、吃子与终局合成音效，可关闭。
- 计时局最后 30 秒的时钟会变红闪动；棋谱自动滚动到当前着法，聊天自动滚动到最新消息；提示条数秒后自动消失。
- 双方吃子栏按车、马、炮、象、士、兵归类计数，跟随悔棋、复盘、推演和重开更新。
- 自动跟随系统深浅色，适配手机安全区域，并尊重系统减少动态效果设置。
- 长轮询同步：页面带上已有的版本号来问，没有变化时服务器最多等 8 秒再答，对方落子约半秒内送到；在线状态最多每 4 秒写一次。配合服务器版本比较，避免并发操作覆盖。
- 三次重复局面时：单方持续将军者判负，否则判和；60 回合未吃子判和。
- 可安装为应用（PWA，桌面与安卓 Chrome）：断网也能打开大厅与 `/ai/` 人机对局，引擎在第一次打开 `/ai/` 时存到设备上；好友房间需要联网，断网时提示打不开，不显示旧棋局。

## 账号（Google 登录）

不登录照样能下棋。页头的「登录」用 Google 账号登录，只请求基本资料（openid、email、profile），在 Worker 内完成授权码 + PKCE 流程，不保存 Google 的令牌。登录后会换一个新的会话 Cookie（HttpOnly，180 天），最近 30 天内以匿名身份坐过的棋室座位转到账号名下，换设备登录同一账号也能认出你。账号菜单里可以退出登录、查看[隐私说明](public/privacy.html)、删除账号（账号、登录方式与所有会话立即删除）。服务器没有配置 Google 客户端时，登录按钮不显示。

复杂长捉等完整赛事裁判细则不在当前好友局裁决范围内，页面规则中有明确说明。当前版本不包含排位或付费模块。

## 人机练习与局势分析

首页「人机对弈」进入独立的 `/ai/` 棋室。支持选择红黑方、入门/进阶/挑战三个档位、悔棋、认输、棋谱回看和独立推演。悔棋回到我方上一次落子前，包含 AI 已走的回复。练习局只保存在页面内，刷新会清空。首次设置时右上角退出返回首页；已有棋局时关闭设置会继续当前对局。

人机对局与推演同样有落子音效、将军与绝杀动画（音效开关与好友对局共用，位于桌面操作栏或手机菜单）。局势分析可开关，展示红方视角评分、推荐着法、后续变化及搜索深度；评分不是胜率。分析适用于当前练习、复盘或推演局面。手机使用底部详情窗口，棋盘不随窗口开关缩小。

Fairy-Stockfish 以 WebAssembly 在独立 Worker 内计算，选择象棋规则、经典评估器（不加载 NNUE）、单搜索线程与 16 MiB 哈希。难度是搜索预算与引擎技能档位，不对应已测定的等级分。对战和分析串行执行；悔棋、换局、复盘或页面转入后台会取消当前任务，旧结果不能落入新局面。裁决仍以本项目棋规为准，复杂赛事规则未完整覆盖。

`/ai/` 需要 SharedArrayBuffer，因此页面必须“跨源隔离”。Worker 通过 `public/_headers` 为 `/ai` 与 `/ai/*`（含引擎文件）下发 COOP/COEP，隔离不靠 Service Worker；开发服务器在 `vite.config.ts` 里用中间件下发相同的头。装成应用后的 Service Worker（`web/sw.js`）只在设备上存页面和引擎，存下的响应带着同样的头，所以断网时 `/ai/` 仍然隔离、引擎照常启动。需要支持 WebAssembly SIMD 与 SharedArrayBuffer 的现代浏览器，加载失败会提示重试；不支持的内置浏览器请改用系统浏览器。

引擎版本、对应源码、构建说明及 GPL-3.0 许可见 `public/ai/engine/SOURCE.md`、`Copying.txt` 与 `AUTHORS`。打包进页面的其他依赖及其许可由构建生成到 `dist/client/third-party-licenses.md`，随网站发布。

## 开发与验证

技术栈：Vite + React 前端；一个 Cloudflare Worker（Hono）同时提供静态页面与 `/api/*`；D1 存棋局。页面是静态资源，只有 `/api/*`（和安卓 App 用的 `/.well-known/assetlinks.json`）会唤醒 Worker。

```bash
npm install
npm run dev          # 自动迁移本地 D1，然后启动 http://localhost:5173
npm run build        # 生成 dist/（dist/client 为页面，dist/chuhan_xiangqi 为 Worker）
npm run preview      # 本地预览构建结果
```

数据库定义在 `db/schema.ts`，用 `npm run db:generate` 生成迁移到 `drizzle/`；本地迁移是 `npm run db:migrate:local`，`npm run dev` 会自动执行。

- `npm test`：棋规与对局状态测试，包含标准开局三层走法总数 44 / 1920 / 79666。
- `npm run test:mobile`：再战邀请、终局悔棋、静默点击、聊天气泡与旧棋谱兼容。
- `npm run test:ui`：吃子分组、走棋过渡、音效去重与终局提示判断。
- `npm run test:ai`：坐标/FEN、红黑悔棋、评分视角、串行取消及真实 WASM 六步合法走棋与分析。
- `npm run test:identity`：同源与 Cookie 身份规则、`/ai` 隔离响应头、Worker 只在 `/api/*` 和 `assetlinks.json` 上运行的部署配置检查；`assetlinks.json` 只在正式域名给出，并与 `android/twa-manifest.json` 一致；Google 登录的 PKCE、回跳地址与令牌校验；在临时本地 D1 上验证建号、会话、座位转移、换号、过期、退出与删除账号。
- `npm run test:online -- http://localhost:5173`：通过两个独立身份及观战者验证 API 对局流程。
- `npm run test:offline`：构建后在 Chromium 里检查应用清单与图标；打开一次 `/ai/` 后断网重载，验证页面仍跨源隔离、引擎能启动并搜索、大厅能打开、好友房间提示打不开，任何 `/api/` 响应都不进缓存；最后验证 Service Worker 的关闭开关。
- `npm run typecheck`：类型检查。

棋局没有公开列表；持有棋室链接者可以进入或观战。保留原浏览器数据（Cookie）可恢复座位。重开前可导出棋谱；重开会替换当前棋谱。

## 部署到 Cloudflare

仓库不含任何账号信息，首次上线需要你自己完成：

1. `npx wrangler login`，然后创建两个数据库：`npx wrangler d1 create chuhan-xiangqi` 与 `npx wrangler d1 create chuhan-xiangqi-staging`，把输出的 `database_id` 分别填进 `wrangler.jsonc`（顶层与 `env.staging`）。
2. 先上预发：`npm run db:migrate:staging && npm run deploy:staging`，用 Cloudflare 给的 `*.workers.dev` 地址验证。
3. 再上线：`npm run db:migrate:production && npm run deploy`。正式环境在 https://chuhanxiangqi.com ，预发在 https://staging.chuhanxiangqi.com （见 `wrangler.jsonc` 的 `routes`）。
4. 自动部署：在 GitHub 仓库的 Settings → Secrets 中添加 `CLOUDFLARE_API_TOKEN`（建议基于 “Edit Cloudflare Workers” 模板，并确认含 D1 编辑权限）与 `CLOUDFLARE_ACCOUNT_ID`。之后推送到 `main` 会先跑测试，再自动更新预发；上线则在 Actions 里手动运行 “Test and deploy” 并选择 `production`。未配置密钥时只跑测试，不部署。

### 开启 Google 登录

1. 在 Google Cloud Console 的 Google Auth Platform 里配置应用信息（应用名、支持邮箱、授权域名 `chuhanxiangqi.com`、隐私政策 `https://chuhanxiangqi.com/privacy`），再创建一个「Web 应用」OAuth 客户端，已获授权的重定向 URI 填：`https://chuhanxiangqi.com/api/auth/google/callback`、`https://staging.chuhanxiangqi.com/api/auth/google/callback`、`http://localhost:5173/api/auth/google/callback`。
2. 把客户端 ID 与密钥写进 Worker：正式环境 `npx wrangler secret put GOOGLE_CLIENT_ID` 和 `npx wrangler secret put GOOGLE_CLIENT_SECRET`，预发环境同样两条命令再加 `--env staging`。本地开发写在项目根目录的 `.dev.vars`（已被 Git 忽略）：

   ```
   GOOGLE_CLIENT_ID=…
   GOOGLE_CLIENT_SECRET=…
   ```

3. 账号表由 `drizzle/0001_accounts.sql` 建立：GitHub Actions 部署前会自动迁移；手动部署时先运行对应的 `db:migrate:*`。迁移之前即使先部署了新代码，下棋也不受影响，只是不显示登录。

### 安卓 App（Google Play）

安卓 App 是 Trusted Web Activity：Bubblewrap 照 `android/twa-manifest.json` 生成的外壳，用手机上的 Chrome 全屏打开正式站，所以网站一部署，App 里就是新版。注册 Play 开发者账号、生成上传密钥、打包、封闭测试、Digital Asset Links 和 Data safety 表的步骤见 [docs/google-play.md](docs/google-play.md)；密钥和打出的包都不进 Git。

旧的 GitHub Pages 前端与旧后端互相独立：本版本不再向 Pages 发布，旧站停留在最后一次发布的状态；新旧站点使用各自的数据库，棋局不会迁移。


## 许可

本项目的代码和我们自己画的美术（SVG、CSS）以 GNU Affero General Public License 第 3 版或（由你选择）任何更新的版本授权，全文见 `LICENSE`。简单说：可以用、改、自己架站；但把改过的版本提供给别人用，包括只是架成网站让人访问，就要按同一许可向这些用户提供完整源码。

下面这些各有自己的许可，不在上面的范围内：

- 象棋引擎 Fairy-Stockfish（`public/ai/engine/`）：GPL-3.0，见该目录的 `SOURCE.md`、`Copying.txt` 与 `AUTHORS`。
- 棋子字体 `assets/chuhan-pieces.woff2` 是 Ma Shan Zheng 的子集：SIL Open Font License 1.1，见 `public/fonts/OFL-MaShanZheng.txt`。
- 落子声 `public/sounds/move.mp3`：CC0，见 `public/sounds/SOURCE.md`。
- 打包进页面的 npm 依赖：各自的许可，构建时汇总到 `dist/client/third-party-licenses.md`。
- 安卓 App 的外壳：由 Bubblewrap 照 `android/twa-manifest.json`（我们的配置）在打包时生成，生成的工程不进仓库。Bubblewrap 的模板代码和打进 App 的 android-browser-helper、AndroidX 都是 Apache-2.0，可以和 AGPL 第 3 版的作品一起分发。

名字和标志不随代码授权（AGPL 第 7 条第 e 款）：「楚汉棋社」「Chuhan Xiangqi」两个名字、印章标志（`public/icon.svg`、由它导出的应用图标 `public/icons/` 与页头的「楚」字印章）和分享图（`assets/og-image.svg`、`public/og-image.png`）。发布改过的版本请换上自己的名字和标志；如实写明「基于楚汉棋社」不受限制。

**License (English).** The code and our own artwork are licensed under the GNU AGPL, version 3 or (at your option) any later version; see `LICENSE`. If you run a modified version for other people, including as a website, you must offer them its complete source under the same license. The engine (GPL-3.0), the piece font (OFL-1.1), the move sound (CC0), the Android wrapper Bubblewrap generates (Apache-2.0) and the bundled npm packages keep their own licenses, listed above. The names 楚汉棋社 and Chuhan Xiangqi, the seal logo and the share card are not licensed (AGPL section 7(e)): a modified version must carry its own name and logo; saying that it is based on Chuhan Xiangqi is fine.
