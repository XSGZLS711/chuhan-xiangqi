# 上架 Google Play（Trusted Web Activity）

安卓 App 是一个 Trusted Web Activity（TWA）：一个很小的 Android 外壳，用手机上的 Chrome 全屏打开 https://chuhanxiangqi.com 。App 里跑的就是网站本身，所以 Service Worker、`/ai/` 的跨源隔离、`SERVICE_WORKER` 关闭开关都照旧，网站一部署，App 里就是新版，不用重新上传。Cookie、登录和「最近对局」跟手机上的 Chrome 是同一份。

外壳由 [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)（Google Chrome Labs，Apache-2.0）生成。下文的命令都在 Mac 上、仓库的 `android/` 目录里跑，Bubblewrap 用 `npx` 按固定版本取，不装进网站的依赖。

## 仓库里有什么

- `android/twa-manifest.json`：App 的全部设置，是唯一进 Git 的 Android 文件。Android 工程（Gradle、Java、图标）由 Bubblewrap 照它生成在 `android/` 里，和打出的包一起被 `.gitignore` 挡在 Git 外面；同一个 Bubblewrap 版本每次生成的都一样。
- `worker/asset-links.ts`：`/.well-known/assetlinks.json` 只在 `chuhanxiangqi.com` 上返回，预发和 workers.dev 地址一律 404，所以它们不会被当成这个 App 的网站。文件本身（`public/.well-known/assetlinks.json`）要等 Play Console 给出签名指纹才有，见第 5 步。
- 上传密钥（`android.keystore`）只在你本机，`.gitignore` 里有 `*.keystore`、`*.jks`、`*.p12`，打出的 `.aab`、`.apk` 也不进 Git。

`twa-manifest.json` 是用 Bubblewrap 1.27.0 的 `TwaManifest.fromWebManifestJson`（就是 `bubblewrap init` 读 `https://chuhanxiangqi.com/manifest.webmanifest` 用的那段代码）从仓库里的 manifest 生成的。名字、图标、颜色、`start_url`、`scope`、`display` 都照 manifest，和 Bubblewrap 默认值不同的只有：

| 字段                                                                          | 值                    | 为什么                                                                                                                                |
| ----------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packageId`                                                                   | `chuhanxiangqi.app`   | 站长定的（2026-11-09）。**第一次上传到 Play 之后永远不能改**，`test:identity` 也钉住了它。Bubblewrap 默认会起 `com.chuhanxiangqi.twa` |
| `enableNotifications`                                                         | `false`               | 网站不发通知；关掉后 App 不申请通知权限                                                                                               |
| `minSdkVersion`                                                               | `24`（Android 7.0）   | Bubblewrap 默认 21，但它用的 androidbrowserhelper 2.7.4 要求至少 24，否则打包时 Manifest 合并失败                                     |
| `themeColorDark`、`navigationColor`、`navigationColorDark`、两个 divider 颜色 | `#F4F0E9` / `#191C1B` | 状态栏和导航栏跟网站的浅色、深色底色一致（`index.html` 的两条 `theme-color`）；默认是黑色                                             |

Bubblewrap 1.27.0 生成的工程：`targetSdkVersion 36`（Google 规定 2026-08-31 起新 App 必须 targetSdk 36）、`androidbrowserhelper 2.7.4`、Android Gradle Plugin 8.9.1、Gradle 8.11.1、build-tools 36.1.0，需要 JDK 17。2026-11-09 在云端照下面的步骤打过一次包（用一把用完即删的测试密钥）：`.aab` 约 1.3 MB；合并后的 Manifest 只有 AndroidX 自带的内部权限 `chuhanxiangqi.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`（签名级，只有本 App 能用），不申请网络、通知、位置等任何面向用户的权限；只认 `https://chuhanxiangqi.com` 一个网站。

## 1. 一次性：装工具

```bash
cd android
npx @bubblewrap/cli@1.27.0 doctor
```

第一次运行时 `npx` 先问要不要下载 Bubblewrap（`Ok to proceed? (y)`，回车）。接着 Bubblewrap 依次问：要不要替你装 JDK（`Y`）、要不要替你装 Android SDK（`Y`）、同不同意 Android SDK 的条款（`y`）。都装在 `~/.bubblewrap/`（JDK 连源码约 1 GB，下载约 360 MB）。最后打出 `Your jdkpath and androidSdkPath are valid.` 就好了。

## 2. 一次性：生成上传密钥

```bash
cd android
~/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home/bin/keytool -genkeypair -v -keystore android.keystore -alias android -keyalg RSA -validity 20000 -dname "CN=Chuhan Xiangqi"
```

（`keytool` 的路径以 `~/.bubblewrap/config.json` 里的 `jdkPath` 为准，后面加 `/Contents/Home/bin/keytool`。）密码设一个，打包时 Bubblewrap 问的两个密码（key store、key）都填它。

- `android/android.keystore` 不进 Git。把它和密码另存一份（密码管理器、移动硬盘）。不要在仓库里跑 `git clean -x`，它会删掉被忽略的文件。
- 这是**上传密钥**。真正给 App 签名的是 Google 在 Play App Signing 里保管的另一把密钥；上传密钥丢了可以在 Play Console 的 App integrity 里申请重置，App 不会丢。

## 3. 打包

第一次：先照 `twa-manifest.json` 生成 Android 工程（版本号保持 1），再打包。

```bash
cd android
npx @bubblewrap/cli@1.27.0 update --skipVersionUpgrade
```

```bash
cd android
npx @bubblewrap/cli@1.27.0 build
```

`update` 会从正式站下载图标和 manifest，所以正式站要已经是带这些图标的版本。第一次 `build` 会先装 build-tools，要再接受一次 Android SDK 许可（一长段条款后面的 `Accept? (y/N)`，答 `y`），然后 Gradle 下载依赖、编译（第一次几分钟），最后问两次密钥密码。产出在 `android/` 里：

- `app-release-bundle.aab`：上传到 Play Console 的就是它。
- `app-release-signed.apk`：用上传密钥签名，可以 `adb install app-release-signed.apk` 装到自己手机上先试。

（直接跑 `build` 也行，但它找不到工程时会顺手 `update` 并把版本号加到 2。）

以后每发一个新版本（只有 `twa-manifest.json` 要改，或 Google 提高 targetSdk 要求时才需要；网站更新不需要）：

```bash
cd android
npx @bubblewrap/cli@1.27.0 update
```

```bash
cd android
npx @bubblewrap/cli@1.27.0 build
```

`update` 把 `appVersionCode` 加一并重新生成工程；把改过的 `twa-manifest.json` 提交进 Git。这个文件的格式归 Bubblewrap 管（`.oxfmtrc.json` 里排除了它）：手改或格式化过，下次 `build` 就会问要不要更新工程，答 `Y` 版本号又会加一。

## 4. Play Console：注册、建应用、内部测试

1. 在 https://play.google.com/console/signup 注册**个人**开发者账号：一次性 25 美元，满 18 岁，按提示做身份验证（证件）；新的个人账号还要在一台 Android 手机上装 Play Console App 验证你能用安卓设备。开发者名字会显示在商店页上。
2. 创建应用：类型选「游戏」、免费（免费 App 以后不能改成收费）。商店页的标题、简介照 [play-store-listing.md](play-store-listing.md) 填（英文为默认语言，加中文和越南语）。
3. 先用**内部测试**（Testing → Internal testing，最多 100 人，上传后很快就能装）：上传 `app-release-bundle.aab`。第一次上传时选用 Google 生成的应用签名密钥（Play App Signing，默认就是）。把自己加进测试者，用测试链接装到手机上。

## 5. Digital Asset Links：让 App 不显示地址栏

在 Play Console 的 App integrity → App signing 里，复制两个 SHA-256 指纹：「App signing key certificate」（Google 的签名密钥，商店装的 App 用它）和「Upload key certificate」（你的上传密钥，`adb install` 装的包用它）。然后：

```bash
mkdir -p public/.well-known
```

```bash
cd android
npx @bubblewrap/cli@1.27.0 fingerprint add <App signing key 的 SHA-256> --name="Play App Signing" --output=../public/.well-known/assetlinks.json
```

```bash
cd android
npx @bubblewrap/cli@1.27.0 fingerprint add <Upload key 的 SHA-256> --name="Upload key" --output=../public/.well-known/assetlinks.json
```

这会把指纹记进 `twa-manifest.json`，并照它写出 `public/.well-known/assetlinks.json`。`npm run test:identity` 会核对两者一致（包名、指纹）。指纹不进 Android 工程，所以之后 `build` 问要不要更新工程时可以答 `N`，等下次发版本再更新。两个文件一起提交、合并，部署正式站，然后：

```bash
curl -i https://chuhanxiangqi.com/.well-known/assetlinks.json
```

```bash
curl -i https://staging.chuhanxiangqi.com/.well-known/assetlinks.json
```

第一条应当是 `200`、`content-type: application/json`，第二条 `404`。再用 Google 的接口确认它读得到：https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://chuhanxiangqi.com&relation=delegate_permission/common.handle_all_urls 。之后打开内部测试装的 App，应当没有地址栏。还有地址栏就卸载重装一次（Android 在安装时验证网站）。

这一步最好在邀请封闭测试的人之前做完，这样他们一装上就是全屏的。

## 6. 封闭测试，然后申请正式上架

按 Google 现行规则（Play Console 帮助「App testing requirements for new personal developer accounts」，2023 年 11 月 13 日之后注册的个人账号适用）：**至少 12 名测试者连续 14 天处于已加入状态的封闭测试**，之后才能在 Dashboard 里申请正式上架（Apply for production），要回答几道关于测试的问题，Google 审核后才开放正式轨道。被拒的话要重新测。

- Testing → Closed testing 建一个轨道，测试者用邮箱名单或 Google 群组添加；把同一个 `.aab` 发到这个轨道（也可以从内部测试升级）。
- 每位测试者要有 Google 账号和安卓手机，打开加入链接点「成为测试者」，再从 Play 安装。中途退出的不算，所以多招几个（这批 20 位海外测试用户正好）。
- 封闭测试的版本也要过 Google 审核，第 7 步的申报要先填完。

## 7. 应用内容申报（App content）

- **隐私政策**：`https://chuhanxiangqi.com/privacy.html`（会 307 跳到 `/privacy`，两个地址都能用；Google 登录的同意页填的是 `/privacy`）。
- **广告**：没有。
- **应用访问权限**：所有功能不登录也能用。
- **目标受众**：13 岁及以上（隐私说明写了不面向 13 岁以下的儿童）。
- **内容分级问卷**：游戏；用户之间可以交流（好友棋室有聊天）；没有购买、没有分享位置。
- **删除账号**：用 Google 登录会建账号，Play 要求给一个删除账号的网页地址。可以填 `https://chuhanxiangqi.com/privacy`（「删除账号」一节写了怎么删；页面里没有锚点），也可以写邮箱 `feedback@chuhanxiangqi.com`。
- **用户生成内容（风险）**：好友棋室的聊天是一对一的用户交流。Play 的 User Generated Content 政策要求这类功能在 App 内能**屏蔽用户**、能**举报**内容和用户，并且用户发内容前要先接受使用条款。现在这三样都还没有（ROADMAP 的 M4 里有「举报按钮 + 屏蔽对手 + 聊天限频」）。站长决定（2026-11-09）上架前先不做；审核要是因此退回，再按退回理由补。

### Data safety 表（按 `public/privacy.html` 起草，提交前请再核对）

总体答案：会收集用户数据；**不与第三方共享**（Cloudflare 是替我们托管和处理数据的服务商，按 Google 的定义不算共享）；数据传输全程加密（HTTPS）；用户可以要求删除数据（账号菜单里「删除账号」，或发邮件）。

| 数据类型                            | 收集什么                                                                                                  | 必需还是可选                       | 用途               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------ |
| 个人信息 · 姓名                     | 登录时 Google 上的名字（最多 32 字）；棋室里自己填的称呼                                                  | 可选                               | 应用功能、账号管理 |
| 个人信息 · 电子邮件地址             | 登录时经 Google 验证的邮箱，只显示给本人                                                                  | 可选                               | 账号管理           |
| 个人信息 · 用户 ID                  | Google 账号编号                                                                                           | 可选                               | 账号管理           |
| 设备或其他 ID                       | 匿名 Cookie 里的随机编号（服务器只存哈希），用来在棋室里认出你                                            | 必需                               | 应用功能           |
| 消息 · 其他应用内消息               | 好友棋室的聊天                                                                                            | 可选                               | 应用功能           |
| 应用活动 · 其他用户生成的内容       | 棋室的棋盘和着法；登录后下完的对局（着法、双方称呼、结果、日期）                                          | 必需（棋室）/ 可选（账号下的对局） | 应用功能           |
| 应用活动 · 应用互动                 | 访问记录：打开哪一页、从哪个网站点进来（只记网站名）、浏览器和界面语言、是否触屏；不带 Cookie，分不出是谁 | 必需（自动发送）                   | 分析               |
| 应用信息和性能 · 崩溃日志、诊断信息 | 错误报告：错误信息、调用栈、页面路径（不含房间号）、User-Agent 和语言；不带 Cookie                        | 必需（自动发送）                   | 分析、应用功能     |
| 位置 · 大致位置                     | 访问记录里有 Cloudflare 按 IP 判断的国家或地区，只到国家一级、7 天后删除                                  | 必需（自动发送）                   | 分析               |

「大致位置」按站长的决定（2026-11-09）申报：Google 对「由 IP 推断的国家」算不算大致位置没有明确说法，各家 SDK 的申报也不一致，报了不会错。

不收集：精确位置、通讯录、照片和视频、音频、文件、日历、财务信息、健康信息、网页浏览记录、已安装的应用。引擎分析只在设备上，不上传。
