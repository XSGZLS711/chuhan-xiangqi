# 越南语界面审校表（临时文件）

> **合并前删除本文件和 `docs/vi-review/` 截图目录。** 它们只用来请越南朋友逐条校对 `lib/locales/vi.ts` 和看版面，校对结果改进 `vi.ts` 之后就没有用了。

这张表由 `lib/locales/zh.ts`、`en.ts`、`vi.ts` 生成，列出界面上的全部 536 个文案键，按界面分组：大厅、好友房、AI 对局、复盘、讲解、错误、设置。

- `{side}`、`{move}`、`{n}` 这类花括号是程序填入的内容（红黑方、着法、数字），**请保留原样**，可以挪动位置。
- 标了 ⚑ 的条目需要特别看一眼：文字游戏（先用了平实说法）、为了版面缩短的说法、需要确认的术语。
- 越南语没有单复数变化，`.one` 和 `.other` 两条写成一样（`.one` 在越南语下不会显示）。
- 棋盘上的汉字（帅、車、楚河 漢界……）是图案，不翻译。

**Gửi bạn đọc bản dịch / For the reviewer:** cột cuối là bản dịch tiếng Việt cho giao diện trang cờ tướng chuhanxiangqi.com. Bạn chỉ cần sửa những chỗ chưa tự nhiên hoặc sai thuật ngữ, giữ nguyên các phần trong ngoặc nhọn như `{side}`, `{move}`. Các dòng có dấu ⚑ là chỗ cần bạn góp ý thêm. *The last column is the Vietnamese text of the site. Please fix anything unnatural or any wrong chess term; keep the `{braces}` as they are. Rows marked ⚑ need your opinion.*

## 越南记谱（请朋友确认）

越南语界面用越南记谱，按局面重新计算，不从中文着法翻译。规则按越南《Luật Cờ Tướng》的写法：

- 棋子字母：**Tg** 将/帅、**S** 士/仕、**T** 象/相、**X** 车、**P** 炮、**M** 马、**B** 兵/卒（Binh，避免和 Tượng 的 T 冲突）。
- 动作：`.` 进（tiến）、`/` 退（thoái）、`-` 平（bình）。路数各自从己方右手边数 1–9；马、象、士写落点的路数，车、炮、兵、将直走时写步数。
- 同一路两个同样的棋子：在字母后面写 **t**（trước，前）或 **s**（sau，后），代替路数，例如规则书里的 `Pt/1`、`Xs.2`；同一路三个兵，中间的写 **g**（giữa），例如 `Bg.1`。
- **没查到资料的两处，请朋友确认：**（1）同一路四五个兵时，中间几个兵怎么写——现在按 WXF 的做法在字母前编号（`2B-8`）；（2）两个士或两个象在同一路时是否也用 t / s（现在和中文记谱、WXF 一样会用，例如 `St/5`；有资料说越南习惯不用）。

| # | 局面 | 中文 | WXF | 越南 |
|---|---|---|---|---|
| 1 | 开局：红炮平中 | 炮二平五 | C2=5 | P2-5 |
| 2 | 开局：黑马跳 | 马8进7 | H8+7 | M8.7 |
| 3 | 开局：红马跳 | 马二进三 | H2+3 | M2.3 |
| 4 | 黑车平移 | 車9平8 | R9=8 | X9-8 |
| 5 | 车后退一步 | 車一退一 | R1-1 | X1/1 |
| 6 | 相（象）飞：落点写路数 | 相三进五 | E3+5 | T3.5 |
| 7 | 仕（士）上：落点写路数 | 仕四进五 | A4+5 | S4.5 |
| 8 | 帅（将）进一：越南写 Tg | 帅五进一 | K5+1 | Tg5.1 |
| 9 | 兵进一 | 兵七进一 | P7+1 | B7.1 |
| 10 | 同路两车：前车 | 前車进二 | +R+2 | Xt.2 |
| 11 | 同路两马：后马 | 后马进五 | -H+5 | Ms.5 |
| 12 | 同路两炮：前炮退一（越南规则书的例子 Pt/1） | 前炮退一 | +C-1 | Pt/1 |
| 13 | 同路三兵：中兵平移 | 中兵平六 | 2P=6 | Bg-6 |
| 14 | 同路三兵：后兵平移 | 后兵平四 | -P=4 | Bs-4 |
| 15 | 同路五兵：第二个兵（越南写法未查到，按 WXF 编号） | 二兵平八 | 2P=8 | 2B-8 |

## 大厅

### 页面标题与品牌

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `brand.name` | 楚汉棋社 | Chuhan Xiangqi | Chuhan Xiangqi ⚑ *专有名词：暂用和英文相同的 Chuhan Xiangqi（与域名一致）；也可以考虑 Cờ tướng Sở Hán，请所有者决定* |
| `meta.home.title` | 楚汉棋社 · 好友象棋对战 | Chuhan Xiangqi · Play Xiangqi with Friends | Chuhan Xiangqi · Chơi cờ tướng cùng bạn bè |
| `meta.home.description` | 邀请好友在线下中国象棋。无限悔棋、独立推演、棋谱复盘，打开链接即可入座。 | Play Chinese chess online with friends. Unlimited undo, free exploration and move-by-move review. Open the link and take a seat. | Chơi cờ tướng trực tuyến với bạn bè. Đi lại không giới hạn, tự do thử nước và xem lại từng nước. Mở liên kết là vào bàn. |
| `meta.ai.title` | 人机练习 · 楚汉棋社 | Play the Computer · Chuhan Xiangqi | Chơi với máy · Chuhan Xiangqi |
| `meta.ai.description` | 在浏览器中与象棋 AI 练习，查看实时局势、推荐走法与棋谱复盘。 | Practice against a xiangqi engine in your browser, with live evaluation, recommended moves and game review. | Luyện cờ tướng với máy ngay trên trình duyệt, kèm đánh giá thế cờ trực tiếp, nước gợi ý và xem lại ván cờ. |

### 大厅与最近对局

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `lobby.title` | 今天，和谁下盘棋？ | Who are you playing today? | Hôm nay, chơi cờ với ai? |
| `lobby.friend` | 好友对弈 | Play a friend | Chơi với bạn |
| `lobby.ai` | 人机对弈 | Play the computer | Chơi với máy |
| `lobby.explore` | 先随手推演 | Try a few moves first | Thử vài nước trước |
| `recent.title` | 最近对局 | Recent games | Ván gần đây |
| `recent.synced` | 同步到你的账号，换台设备登录也能看到，最多保留最近 200 局。 | Synced to your account, so you can see them on any device you sign in on. The latest 200 games are kept. | Đồng bộ với tài khoản của bạn, đăng nhập trên thiết bị nào cũng xem được. Giữ tối đa 200 ván gần nhất. |
| `recent.local` | 仅保存在当前浏览器，最多保留最近 200 局。 | Saved in this browser only. The latest 200 games are kept. | Chỉ lưu trên trình duyệt này. Giữ tối đa 200 ván gần nhất. |
| `recent.readError` | 当前浏览器无法读取本地对局。 | This browser cannot read saved games. | Trình duyệt này không đọc được các ván đã lưu. |
| `recent.syncError` | 暂时读不到账号里的对局，先显示本机保存的。 | Cannot load your account's games right now, so the ones saved on this device are shown. | Tạm thời không tải được các ván trong tài khoản, nên hiển thị các ván lưu trên thiết bị này. |
| `recent.loading` | 正在读取… | Loading… | Đang tải… |
| `recent.empty` | 还没有已结束的对局，下完一盘后会自动保存在这里。 | No finished games yet. Once you finish one, it is saved here automatically. | Chưa có ván nào kết thúc. Chơi xong một ván, ván đó sẽ tự động được lưu ở đây. |
| `recent.mode.ai` | 人机 | vs computer | với máy |
| `recent.mode.friend` | 好友 | vs friend | với bạn |
| `recent.moves.one` | {n} 步 | {n} move | {n} nước |
| `recent.moves.other` | {n} 步 | {n} moves | {n} nước |
| `notice.dismiss` | 关闭提示 | Dismiss | Đóng thông báo |
| `archive.saveFailed` | 这盘棋暂未保存：浏览器的本地存储不可用或空间已满。 | This game was not saved: browser storage is unavailable or full. | Ván cờ này chưa được lưu: bộ nhớ trình duyệt không dùng được hoặc đã đầy. |

### 账号

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `account.label` | 账号：{name} | Account: {name} | Tài khoản: {name} |
| `account.initial` | 棋 | P | B ⚑ *没有名字时头像里显示的字母，取自 Bạn cờ* |
| `account.wait` | 请稍候… | One moment… | Chờ một chút… |
| `account.signOut` | 退出登录 | Sign out | Đăng xuất |
| `account.privacy` | 隐私说明 | Privacy | Quyền riêng tư |
| `account.delete` | 删除账号 | Delete account | Xóa tài khoản |
| `account.signIn.label` | 使用 Google 账号登录 | Sign in with Google | Đăng nhập bằng Google |
| `account.signIn` | 登录 | Sign in | Đăng nhập |
| `account.notice.signin` | Google 登录没有完成，请再试一次。 | Google sign-in did not finish. Please try again. | Đăng nhập Google chưa hoàn tất. Hãy thử lại. |
| `account.notice.signout` | 退出登录没有成功，请再试一次。 | Could not sign out. Please try again. | Chưa đăng xuất được. Hãy thử lại. |
| `account.notice.delete` | 删除账号没有成功，请再试一次。 | Could not delete the account. Please try again. | Chưa xóa được tài khoản. Hãy thử lại. |
| `account.confirmDelete` | 删除账号后，账号和登录记录会被永久删除，所有设备都会退出登录。本机保存的对局不受影响。确定删除吗？ | Deleting your account permanently removes it and its sign-in records, and signs you out on every device. Games saved on this device are not affected. Delete it? | Xóa tài khoản sẽ xóa vĩnh viễn tài khoản và lịch sử đăng nhập, đồng thời đăng xuất trên mọi thiết bị. Các ván lưu trên thiết bị này không bị ảnh hưởng. Bạn chắc chắn muốn xóa? |

## 好友房

### 棋子、胜负与印章（两种对局共用）

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `side.red` | 红方 | Red | Đỏ |
| `side.black` | 黑方 | Black | Đen |
| `side.red.short` | 红 | Red | Đỏ |
| `side.black.short` | 黑 | Black | Đen |
| `piece.red.k` | 帅 | General | Tướng |
| `piece.red.a` | 仕 | Advisor | Sĩ |
| `piece.red.e` | 相 | Elephant | Tượng |
| `piece.red.h` | 马 | Horse | Mã |
| `piece.red.r` | 車 | Chariot | Xe |
| `piece.red.c` | 炮 | Cannon | Pháo |
| `piece.red.p` | 兵 | Soldier | Tốt |
| `piece.black.k` | 将 | General | Tướng |
| `piece.black.a` | 士 | Advisor | Sĩ |
| `piece.black.e` | 象 | Elephant | Tượng |
| `piece.black.h` | 马 | Horse | Mã |
| `piece.black.r` | 車 | Chariot | Xe |
| `piece.black.c` | 炮 | Cannon | Pháo |
| `piece.black.p` | 卒 | Soldier | Tốt |
| `piece.named` | {side}{piece} | {side} {piece} | {piece} {side} |
| `name.player` | 棋友 | Player | Bạn cờ ⚑ *默认称呼「棋友」* |
| `name.me` | 我方 | You | Bạn |
| `name.ai` | 象棋 AI | Xiangqi AI | AI cờ tướng |
| `reason.mate` | 将死 | Checkmate | Chiếu bí |
| `reason.stalemate` | 困毙 | No legal moves | Hết nước đi ⚑ *术语请确认：困毙 → Hết nước đi* |
| `reason.timeout` | 超时 | Out of time | Hết giờ |
| `reason.perpetual` | 长将判负 | Perpetual check | Chiếu dai ⚑ *术语请确认：长将判负 → Chiếu dai* |
| `reason.agreed` | 双方同意和棋 | Draw by agreement | Hòa theo thỏa thuận |
| `reason.repetition` | 三次重复局面 | Threefold repetition | Lặp lại thế cờ ba lần |
| `reason.quiet` | 连续 60 回合未吃子 | 60 moves without a capture | 60 nước không ăn quân |
| `reason.resigned.red` | 红方认输 | Red resigned | Đỏ xin thua |
| `reason.resigned.black` | 黑方认输 | Black resigned | Đen xin thua |
| `result.draw` | 和棋 | Draw | Hòa |
| `result.won` | 胜 | Won | Thắng |
| `result.lost` | 负 | Lost | Thua |
| `result.sideWon` | {side}胜 | {side} won | {side} thắng |
| `result.sideWins` | {side}获胜 | {side} wins | {side} thắng |
| `result.reasonOnly` | {reason} | {reason} | {reason} |
| `result.withReason` | {side}获胜 · {reason} | {side} wins · {reason} | {side} thắng · {reason} |
| `stamp.capture` | 吃 | Capture | Ăn |
| `stamp.capture.detail` | {side}吃子 | {side} captures | {side} ăn quân |
| `stamp.check` | 将军 | Check | Chiếu |
| `stamp.check.word` | 将 | Check | Chiếu |
| `stamp.check.detail` | {side}应将 | {side} must answer | {side} phải đỡ chiếu |
| `stamp.mate` | 绝杀 | Mate | Chiếu bí |
| `stamp.draw` | 和棋 | Draw | Hòa |
| `stamp.resigned` | 认输 | Resigned | Xin thua |
| `stamp.stalemate` | 困毙 | No moves | Hết nước |
| `stamp.timeout` | 超时 | Time out | Hết giờ |
| `stamp.perpetual` | 长将判负 | Perpetual check | Chiếu dai ⚑ *术语请确认：长将判负 → Chiếu dai* |
| `stamp.over` | 终局 | Game over | Kết thúc |
| `stamp.exploring` | 推演 ·  | Exploring ·  | Thử nước ·  |
| `stamp.exploring.label` | 独立推演 | Exploring | Thử nước |

### 棋室、状态与邀请

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `room.flip` | 翻转棋盘 | Flip the board | Lật bàn cờ |
| `room.sound.off.label` | 关闭对局音效 | Turn game sound off | Tắt âm thanh ván cờ |
| `room.sound.off` | 关闭音效 | Sound off | Tắt âm thanh |
| `room.sound.on.label` | 开启对局音效 | Turn game sound on | Bật âm thanh ván cờ |
| `room.sound.on` | 开启音效 | Sound on | Bật âm thanh |
| `room.connected` | 棋室已连接 | Connected to the room | Đã kết nối phòng cờ |
| `room.reconnect.hint` | 点击重新连接 | Tap to reconnect | Chạm để kết nối lại |
| `room.reconnect.label` | 重新连接棋室 | Reconnect to the room | Kết nối lại phòng cờ |
| `room.rules` | 对局规则 | Rules | Luật chơi |
| `room.friendGame` | 好友对弈 | Friend game | Ván với bạn |
| `room.round` | 第 {n} 局 | Game {n} | Ván {n} |
| `room.invite` | 邀请 | Invite | Mời |
| `room.status.exploring` | 独立推演 | Exploring | Đang thử nước |
| `room.status.replaying` | 复盘中 | Replaying | Đang xem lại |
| `room.status.over` | 本局结束 | Game over | Ván đã kết thúc |
| `room.status.waiting` | 等待好友 | Waiting for a friend | Đang chờ bạn cờ |
| `room.status.watching` | 观战中 | Spectating | Đang xem |
| `room.status.checkYou` | 将军 · 请应将 | Check · answer it | Bị chiếu · hãy đỡ chiếu |
| `room.status.checkThem` | 对方应将 | Opponent must answer check | Đối thủ phải đỡ chiếu |
| `room.status.yourTurn` | 轮到你走 | Your move | Đến lượt bạn |
| `room.status.theirTurn` | 对方思考中 | Opponent is thinking | Đối thủ đang suy nghĩ |
| `room.pill.replay` | 棋谱复盘 | Replaying | Đang xem lại |
| `room.pill.over` | 对局结束 | Game over | Ván đã kết thúc |
| `room.pill.check` | 将军！ | Check! | Chiếu! |
| `room.pill.toMove` | {side}走棋 | {side} to move | Lượt {side} |
| `room.pill.connecting` | 正在连接 | Connecting | Đang kết nối |
| `room.loading.offline` | 暂时无法打开棋室，请重新连接。 | Cannot open the room right now. Please reconnect. | Tạm thời không mở được phòng cờ. Hãy kết nối lại. |
| `room.loading` | 正在打开好友棋室… | Opening the friend room… | Đang mở phòng cờ… |
| `room.presence.online` | 在线 | Online | Trực tuyến |
| `room.presence.offline` | 暂时离线 | Offline | Tạm ngoại tuyến |
| `room.presence.title` | {state} · {side} | {state} · {side} | {state} · {side} |
| `room.seatOpen` | 虚位以待 | Seat open | Ghế trống |
| `room.you` | 我方 | You | Bạn |
| `room.rename` | 改名 | Edit | Đổi tên ⚑ *为版面缩短：玩家栏放不下 Đổi tên，先用 Sửa（＝编辑）* |
| `room.clock.unlimited` | 不限时 | No limit | Không giới hạn ⚑ *为版面缩短：玩家栏放不下 Không giới hạn，先用 Vô hạn* |
| `room.youPlay` | 执{side} | You play {side} | Bạn cầm {side} |
| `room.youPlay.meta` | 执{side} · {time} | You play {side} · {time} | Bạn cầm {side} · {time} |
| `room.rematch` | 重新开局 | Restart | Chơi lại |
| `room.copyRoomLink` | 复制棋室链接 | Copy room link | Sao chép liên kết phòng |
| `room.copyInvite` | 复制邀请链接 | Copy invite link | Sao chép liên kết mời |
| `room.createGame` | 创建好友对局 | Create a friend game | Tạo ván với bạn |
| `room.aiEntry` | 人机对战与局势分析 | Play the computer and analyze positions | Chơi với máy và phân tích thế cờ |
| `room.waitingReply` | 等待好友回应 | Waiting for your friend to reply | Đang chờ bạn cờ trả lời |
| `room.offer.draw` | 好友提议和棋 | Your friend offers a draw | Bạn cờ đề nghị hòa |
| `room.offer.rematch` | 好友邀你再战 | Your friend invites you to a rematch | Bạn cờ mời bạn đấu lại |
| `room.offer.panel.draw` | {side}提议和棋 | {side} offers a draw | {side} đề nghị hòa |
| `room.offer.panel.rematch` | {side}邀请重新开局 | {side} invites you to restart | {side} mời chơi lại từ đầu |
| `room.offer.rematchNote` | 同意后交换先后手，开始新的一局。请先导出要保留的棋谱。 | If you accept, you swap sides and start a new game. Export any record you want to keep first. | Nếu đồng ý, hai bên đổi màu quân và bắt đầu ván mới. Hãy xuất biên bản muốn giữ lại trước. |
| `room.offer.withdraw` | 撤回 | Withdraw | Rút lại |
| `room.offer.withdrawInvite` | 撤回邀请 | Withdraw invitation | Rút lại lời mời |
| `room.offer.decline` | 婉拒 | Decline | Từ chối |
| `room.offer.accept` | 同意 | Accept | Đồng ý |
| `room.offer.acceptRematch` | 应邀出战 | Accept rematch | Nhận lời đấu lại ⚑ *「应邀出战」先用平实说法「接受再战」* |
| `room.rematch.waiting` | 等待应战 | Waiting for a reply | Đang chờ trả lời |
| `room.rematch.again` | 再来一局 | Play again | Chơi ván nữa |

### 走子、推演与复盘按钮

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `play.exploring.other` | 推演 {n} 步 | Exploring · {n} moves | Đang thử · {n} nước |
| `play.exploring.one` | 推演 {n} 步 | Exploring · {n} move | Đang thử · {n} nước |
| `play.backOne` | 退一步 | Back one move | Lùi một nước |
| `play.reset` | 重置 | Reset | Đặt lại |
| `play.backToGame` | 返回对局 | Back to game | Về ván cờ |
| `play.replay` | 复盘 · 第 {n} 步 | Replay · move {n} | Xem lại · nước {n} |
| `play.replay.prev` | 复盘上一步 | Previous move | Nước trước |
| `play.replay.next` | 复盘下一步 | Next move | Nước sau |
| `play.exploreFromHere` | 从此处推演 | Explore from here | Thử nước từ đây |
| `play.undo` | 悔棋 | Undo | Đi lại ⚑ *术语请确认：悔棋 → Đi lại* |
| `play.explore` | 推演 | Explore | Thử nước ⚑ *术语请确认：推演 → Thử nước（试走）* |
| `play.draw` | 提和 | Offer draw | Cầu hòa |
| `play.resign` | 认输 | Resign | Xin thua |
| `play.actions` | 对局操作 | Game menu | Thao tác ván cờ |
| `play.rematchShort` | 重开 | Rematch | Đấu lại |
| `play.rematchInvite` | 邀请重新开局 | Invite to a rematch | Mời đấu lại |
| `play.draw.result` | 和棋 | Draw | Hòa |
| `play.steam` | 再蒸一下 | Undo and play on | Đi lại và chơi tiếp ⚑ *文字游戏：「再蒸一下」先用平实说法（直译「悔棋并继续下」），请朋友看有没有更有味道的说法* |
| `play.steam.small` | 悔棋继续 | Undo and play on | Đi lại và chơi tiếp ⚑ *文字游戏：同上，AI 页终局按钮* |
| `play.steam.hint` | 悔棋继续 | （空） | （空） |
| `play.review` | 复盘 | Review | Xem lại |
| `play.illegal` | 这一步不可走，请选择标记位置。 | That move is not allowed. Pick one of the marked squares. | Không đi được nước này. Hãy chọn một ô đã đánh dấu. |
| `play.noRoom` | 创建好友对局开始对弈，或点击“推演”先试试棋。 | Create a friend game to play, or tap “Explore” to try some moves first. | Tạo ván với bạn để chơi, hoặc chạm “Thử nước” để thử vài nước trước. ⚑ *引号里是「推演」按钮（play.explore）的文字，两处要一致* |
| `play.clock.limit` | 每方 {n} 分钟 | {n} minutes each | Mỗi bên {n} phút |
| `play.clock.unlimited` | 不限时 · 从容对弈 | No time limit · take your time | Không giới hạn thời gian · cứ thong thả |

### 连接提示

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `msg.reconnectHint` | 暂时连接不上棋室，点击右上角重新连接。 | Cannot reach the room right now. Tap the connection icon at the top right to reconnect. | Tạm thời không kết nối được phòng cờ. Chạm biểu tượng kết nối ở góc trên bên phải để kết nối lại. |
| `msg.restored` | 连接已恢复。 | Connection restored. | Đã kết nối lại. |
| `msg.stillOffline` | 仍然无法连接，请检查网络后再试。 | Still cannot connect. Check your network and try again. | Vẫn chưa kết nối được. Hãy kiểm tra mạng rồi thử lại. |
| `msg.inviteCopied` | 邀请链接已复制，发给好友即可入座。 | Invite link copied. Send it to a friend and they can take a seat. | Đã sao chép liên kết mời. Gửi cho bạn cờ là họ vào bàn được ngay. |
| `msg.copyManually` | 请长按或选中链接复制。 | Press and hold, or select the link, to copy it. | Nhấn giữ hoặc chọn liên kết để sao chép. |

### 棋谱、聊天与面板

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `record.title` | 对局棋谱 | Move list | Biên bản ván cờ |
| `record.tab` | 对局棋谱 | Moves | Biên bản |
| `chat.tab` | 棋友聊天 {count} | Chat {count} | Trò chuyện {count} |
| `chat.title` | 棋友聊天 | Chat | Trò chuyện |
| `record.export` | 导出棋谱 | Export the record | Xuất biên bản |
| `record.description.other` | 第 {round} 局 · {n} 步，点击棋谱可回看局面 | Game {round} · {n} moves. Tap a move to see that position. | Ván {round} · {n} nước. Chạm vào một nước để xem thế cờ lúc đó. |
| `record.description.one` | 第 {round} 局 · {n} 步，点击棋谱可回看局面 | Game {round} · {n} move. Tap it to see that position. | Ván {round} · {n} nước. Chạm vào một nước để xem thế cờ lúc đó. |
| `sheet.close` | 关闭窗口 | Close | Đóng |
| `chat.message` | 聊天消息 | Chat message | Tin nhắn |
| `chat.placeholder` | 和棋友说句话… | Say something… | Nói gì đó… |
| `chat.placeholder.watching` | 观战中 | Spectating | Đang xem |
| `chat.send` | 发送消息 | Send message | Gửi tin nhắn |
| `chat.empty` | 以棋会友，聊上两句。 | Chess brings people together. Say hello. | Lấy cờ làm bạn. Chào nhau một câu nhé. ⚑ *成语「以棋会友」，先直译「以棋为友，打个招呼吧」* |
| `chat.empty.small` | 入座后即可发送消息 | You can chat once you have a seat | Vào bàn rồi mới trò chuyện được |
| `chat.author` | {name} · {side} | {name} · {side} | {name} · {side} |
| `record.header.turn` | 回合 | Turn | Lượt |
| `record.header.red` | 红方 | Red | Đỏ |
| `record.header.black` | 黑方 | Black | Đen |
| `record.check` | 将 | chk | chiếu |
| `record.empty` | 棋谱从第一步开始记录 | The record starts with the first move | Biên bản bắt đầu từ nước đầu tiên |
| `record.nav.start` | 回到开局 | Go to the start | Về đầu ván |
| `record.nav.prev` | 上一步 | Previous move | Nước trước |
| `record.nav.next` | 下一步 | Next move | Nước sau |
| `record.nav.latest` | 回到最新局面 | Go to the latest position | Về thế cờ mới nhất |
| `record.rated` | 第 {n} 步，{rating}，查看走前推荐着 | Move {n}, {rating}. Show the recommended move before it. | Nước {n}, {rating}. Xem nước gợi ý trước nước này. |

### 手机底栏

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `dock.toolbar` | 对局工具栏 | Game toolbar | Thanh công cụ ván cờ |
| `dock.leave` | 离开棋室 | Leave the room | Rời phòng cờ |
| `dock.moves` | 棋谱 | Moves | Biên bản |
| `dock.openMoves` | 打开对局棋谱 | Open the move list | Mở biên bản ván cờ |
| `dock.chat.open` | 打开聊天输入 | Open chat | Mở trò chuyện |
| `dock.chat.watching` | 观战中，无法聊天 | Spectating, so chat is unavailable | Đang xem nên không trò chuyện được |
| `dock.chat.placeholder` | 说句话… | Say something… | Nói gì đó… |
| `dock.exploring.exit` | 退出推演，返回对局 | Stop exploring and return to the game | Dừng thử nước và về ván cờ |
| `dock.exploring.start` | 开始独立推演 | Start exploring on your own | Bắt đầu tự thử nước |
| `dock.back` | 返回 | Back | Quay lại |
| `dock.chat.description` | 给对方发送消息，最多 120 字 | Send your opponent a message, up to 120 characters | Gửi tin nhắn cho đối thủ, tối đa 120 ký tự |
| `dock.chat.close` | 关闭聊天 | Close chat | Đóng trò chuyện |
| `dock.chat.compose` | 发送聊天消息 | Chat message | Tin nhắn trò chuyện |
| `dock.send` | 发送 | Send | Gửi |

### 对话框

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `dialog.close` | 关闭 | Close | Đóng |
| `dialog.create.title` | 摆一桌，邀好友。 | Set the table, invite a friend. | Bày bàn cờ, mời bạn chơi. ⚑ *中文是对仗短句，越南语先用平实说法* |
| `dialog.invite.title` | 棋桌已备好，邀友入座。 | The table is set. Invite a friend. | Bàn cờ đã sẵn sàng. Mời bạn vào bàn. |
| `dialog.name.title` | 如何称呼你？ | What should we call you? | Gọi bạn là gì nhỉ? |
| `dialog.rules.title` | 好友对局规则 | Friend game rules | Luật ván với bạn |
| `dialog.invite.description` | 把下面的链接发给好友。第一位访客自动执黑，之后的访客可以观战。 | Send the link below to a friend. The first visitor plays Black automatically; anyone after that can watch. | Gửi liên kết dưới đây cho bạn cờ. Người đầu tiên vào sẽ tự động cầm Đen; những người vào sau có thể xem. |
| `dialog.rules.description` | 红方先行，双方轮流落子。 | Red moves first, and players take turns. | Đỏ đi trước, hai bên lần lượt đi. |
| `dialog.yourName` | 你的称呼 | Your name | Tên của bạn |
| `dialog.clock` | 对局用时 | Time control | Thời gian ván cờ |
| `dialog.preparing` | 正在准备棋桌… | Setting up the table… | Đang bày bàn cờ… |
| `dialog.create` | 创建对局并邀请好友 | Create the game and invite a friend | Tạo ván và mời bạn |
| `dialog.inviteLink` | 邀请链接 | Invite link | Liên kết mời |
| `dialog.saveName` | 保存称呼 | Save name | Lưu tên |
| `dialog.resign.title` | 确认认输？ | Resign the game? | Xin thua ván này? |
| `dialog.rematch.title` | 邀请好友重新开局？ | Invite your friend to restart? | Mời bạn cờ chơi lại từ đầu? |
| `dialog.resign.body` | 本局将判对方获胜。之后仍可自由悔棋，或邀请再来一局。 | Your opponent will win this game. You can still undo moves afterwards, or invite them to play again. | Đối thủ sẽ thắng ván này. Sau đó bạn vẫn có thể đi lại, hoặc mời chơi ván nữa. |
| `dialog.rematch.body` | 好友同意后，会清空本局棋谱并交换先后手。想保留本局，请先导出棋谱。 | If your friend agrees, this game's record is cleared and you swap sides. To keep this game, export the record first. | Nếu bạn cờ đồng ý, biên bản ván này sẽ bị xóa và hai bên đổi màu quân. Muốn giữ ván này, hãy xuất biên bản trước. |
| `dialog.think` | 再想想 | Not yet | Để nghĩ thêm |
| `dialog.resign.confirm` | 确认认输 | Resign | Xin thua |
| `dialog.rematch.confirm` | 发出邀请 | Send invitation | Gửi lời mời |

### 规则

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `rules.1.title` | 走棋与胜负 | Moves and winning | Cách đi quân và thắng thua |
| `rules.1.body` | 车走直线，马走日且不可蹩腿；象走田且不可塞眼、过河；士与将帅不出九宫；炮隔一子吃子；兵卒过河可横走、不可后退。将帅不能照面，也不能让己方被将军。将死、困毙、认输或计时耗尽均判负。 | Chariots slide in straight lines. Horses move in an L and can be blocked by an adjacent piece. Elephants move two points diagonally, cannot be blocked at the midpoint and cannot cross the river. Advisors and Generals stay in the palace. Cannons capture by jumping over exactly one piece. Soldiers step forward and, after crossing the river, sideways, but never back. The two Generals may not face each other on an open file, and you may not leave your own General in check. You lose by checkmate, by having no legal moves, by resigning or by running out of time. | Xe đi thẳng theo hàng dọc hoặc hàng ngang. Mã đi chữ nhật và bị cản nếu có quân đứng ngay cạnh theo hướng đi (cản chân mã). Tượng đi chéo hai ô theo hình chữ điền, bị chặn nếu có quân ở giữa (chặn mắt tượng) và không được qua sông. Sĩ và Tướng chỉ đi trong cung. Pháo ăn quân bằng cách nhảy qua đúng một quân. Tốt đi thẳng, qua sông thì được đi ngang, nhưng không bao giờ được lùi. Hai Tướng không được đối mặt nhau trên một cột trống, và không được để Tướng mình bị chiếu. Bị chiếu bí, hết nước đi, xin thua hoặc hết giờ đều bị xử thua. |
| `rules.2.title` | 无限自由悔棋 | Unlimited undo | Đi lại không giới hạn |
| `rules.2.body` | 任意一方可直接撤回最近一步，不限次数、无需确认。棋子、吃子、轮次与该步开始时的用时一并恢复。结束后也能悔棋继续。 | Either player can take back the last move, as often as they like, with no confirmation. Pieces, captures, whose turn it is and the clocks all return to how they were before that move. You can even undo after the game has ended and play on. | Bên nào cũng có thể rút lại nước vừa đi, bao nhiêu lần cũng được, không cần xác nhận. Quân cờ, quân bị ăn, lượt đi và đồng hồ đều trở lại như trước nước đó. Ván đã kết thúc vẫn có thể đi lại để chơi tiếp. |
| `rules.3.title` | 推演与复盘 | Exploring and review | Thử nước và xem lại |
| `rules.3.body` | 点击棋谱可以回看每一步，也可从任意局面独立推演。推演不会发送给对手；正式对局及计时照常进行。棋谱可导出保存。 | Tap the move list to look back at any move, or explore on your own from any position. Exploring is never sent to your opponent, and the real game and its clocks carry on. The record can be exported. | Chạm vào biên bản để xem lại từng nước, hoặc tự thử nước từ bất kỳ thế cờ nào. Các nước thử không gửi cho đối thủ; ván thật và đồng hồ vẫn chạy bình thường. Biên bản có thể xuất ra để lưu. |
| `rules.4.title` | 好友局循环规则 | Repetition in friend games | Luật lặp nước trong ván với bạn |
| `rules.4.body` | 同一局面第三次出现时，单方持续将军者判负；否则判和。连续 60 回合未吃子自动和棋。长捉等复杂竞赛争议采用好友协商提和，本平台不执行完整赛事裁判细则。 | When the same position appears a third time, the side that has been giving check all along loses; otherwise the game is drawn. Sixty moves in a row without a capture is an automatic draw. Other tournament disputes, such as perpetual chasing, are left to friends to settle by agreeing a draw; this site does not apply the full tournament arbitration rules. | Khi cùng một thế cờ xuất hiện lần thứ ba, bên liên tục chiếu sẽ bị xử thua; nếu không thì hòa. 60 nước liên tiếp không ăn quân thì tự động hòa. Các tranh chấp phức tạp khác của luật thi đấu, như đuổi dai, do hai bên tự thỏa thuận hòa; trang này không áp dụng đầy đủ luật trọng tài thi đấu. |
| `rules.5.title` | 提和、重开与连接 | Draws, restarts and connection | Cầu hòa, chơi lại và kết nối |
| `rules.5.body` | 提和、重新开局需对方同意；重开会交换红黑方。离线不会立即判负，计时局仍继续计时。原浏览器刷新可回到座位；清除浏览器数据会失去座位身份。 | Offering a draw or restarting needs your opponent's agreement, and a restart swaps colors. Going offline does not lose the game at once, though timed games keep their clocks running. Refreshing the same browser returns you to your seat; clearing browser data loses your seat. | Cầu hòa và chơi lại từ đầu cần đối thủ đồng ý; chơi lại sẽ đổi màu quân. Mất kết nối không bị xử thua ngay, nhưng ván có giờ thì đồng hồ vẫn chạy. Tải lại trang trên cùng trình duyệt sẽ trở về chỗ ngồi; xóa dữ liệu trình duyệt sẽ mất chỗ ngồi. |
| `rules.source` | 参考：世界象棋联合会规则 ↗ | Reference: World Xiangqi Federation rules ↗ | Tham khảo: luật của Liên đoàn Cờ tướng Thế giới ↗ |

### 导出的棋谱

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `export.title` | 楚汉棋社 · 第 {round} 局 | Chuhan Xiangqi · Game {round} | Chuhan Xiangqi · Ván {round} |
| `export.players` | {red}（红） 对 {black}（黑） | {red} (Red) vs {black} (Black) | {red} (Đỏ) đấu {black} (Đen) |
| `export.waiting` | 待入座 | waiting for a player | chờ người vào |
| `export.result` | {outcome} · {reason} | {outcome} · {reason} | {outcome} · {reason} |
| `export.inProgress` | 对弈中 | In progress | Đang chơi |
| `export.move` | {n}. {side} {text}{check} | {n}. {side} {text}{check} | {n}. {side} {text}{check} |
| `export.check` |  将军 |  check |  chiếu |
| `export.coordinates` | 坐标记录： | Coordinates (column,row from the top left, counted from 0): | Tọa độ (cột,hàng tính từ góc trên bên trái, bắt đầu từ 0): |
| `export.filename` | 楚汉棋谱-第{round}局.txt | chuhan-xiangqi-game-{round}.txt | chuhan-xiangqi-van-{round}.txt |

### 棋盘（读屏文字）

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `board.label` | 中国象棋棋盘 | Xiangqi board | Bàn cờ tướng |
| `board.square` | {row}行{col}列{what}{move} | Row {row}, column {col}: {what}{move} | Hàng {row}, cột {col}: {what}{move} |
| `board.empty` | 空位 | empty | trống |
| `board.reachable` | ，可走 | , can move here | , đi được tới đây |
| `tray.label.other` | {side}已吃对方 {n} 子 | {side} has captured {n} pieces | {side} đã ăn {n} quân |
| `tray.label.one` | {side}已吃对方 {n} 子 | {side} has captured {n} piece | {side} đã ăn {n} quân |
| `tray.piece` | {piece} {n} 枚 | {piece} ×{n} | {piece} ×{n} |
| `effect.analysis.prefix` | 独立推演 ·  | Exploring ·  | Thử nước ·  |
| `effect.context` | 独立推演 | Exploring | Thử nước |

### 棋室提示

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `note.tableReady` | 棋桌已备好，等待好友入座 | The table is set. Waiting for a friend to sit down. | Bàn cờ đã sẵn sàng. Đang chờ bạn cờ vào bàn. |
| `note.friendJoined` | 好友已入座，红方先行 | Your friend has taken a seat. Red moves first. | Bạn cờ đã vào bàn. Đỏ đi trước. |
| `note.undoEnded` | {side}撤回终局，继续对弈 | {side} took back the ending. Play continues. | {side} đã rút lại nước kết thúc. Ván cờ tiếp tục. |
| `note.undone` | {side}悔了一步 · {move} | {side} took back a move · {move} | {side} đã đi lại một nước · {move} |
| `note.rematchInvited` | {side}邀请重新开局 | {side} invites a restart | {side} mời chơi lại từ đầu |
| `note.declinedDraw` | {side}婉拒了提和 | {side} declined the draw offer | {side} đã từ chối cầu hòa |
| `note.declinedRematch` | {side}婉拒了重开 | {side} declined the restart | {side} đã từ chối chơi lại |
| `note.drawAgreed` | 握手言和 | Handshake. The game is drawn. | Bắt tay hòa cờ. ⚑ *成语「握手言和」，先直译「握手和棋」* |
| `note.swapped` | 交换先后手，新一局开始 | Sides swapped. A new game begins. | Đã đổi màu quân. Ván mới bắt đầu. |
| `note.resigned` | {side}认输 | {side} resigned | {side} xin thua |
| `note.move` | {move} | {move} | {move} |
| `note.moveCheck` | {move} · 将军 | {move} · check | {move} · chiếu |

## AI 对局

### AI 页面

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `ai.level.easy` | 入门 | Beginner | Nhập môn |
| `ai.level.medium` | 进阶 | Intermediate | Trung bình |
| `ai.level.hard` | 挑战 | Challenge | Thử thách |
| `ai.back` | 返回棋社 | Back to the lobby | Về sảnh |
| `ai.loadingGame` | 正在读取本地对局… | Loading the saved game… | Đang tải ván đã lưu… |
| `ai.startPlaying` | 开始人机对弈 | Play the computer | Chơi với máy |
| `ai.newGame` | 新的一局 | New game | Ván mới |
| `ai.newGame.label` | 设置新的一局 | New game settings | Thiết lập ván mới |
| `ai.review` | 对局复盘 | Game review | Xem lại ván cờ |
| `ai.practice` | 人机练习 | Practice | Luyện tập |
| `ai.mobileSub` | {mode} · 第 {n} 局 | {mode} · Game {n} | {mode} · Ván {n} |
| `ai.engineLoading` | 正在准备棋手… | Getting the engine ready… | Đang chuẩn bị máy cờ… |
| `ai.thinking` | AI 思考中 | Computer is thinking | Máy đang suy nghĩ |
| `ai.status.result` | {outcome} · {reason} | {outcome} · {reason} | {outcome} · {reason} |
| `ai.rated` | 第 {n} 步走前 · 推荐：{move} | Before move {n} · Best: {move} | Trước nước {n} · Gợi ý: {move} |
| `ai.rated.none` | 本次推荐着不可用 | No recommendation is available for this move | Không có gợi ý cho nước này |
| `ai.banner` | 本地复盘 · {red} / {black} · {result} · {reason} | Saved game · {red} / {black} · {result} · {reason} | Ván đã lưu · {red} / {black} · {result} · {reason} |
| `ai.retry` | 重试 | Retry | Thử lại |
| `ai.replay` | 复盘 {index}/{total} | Replay {index}/{total} | Xem lại {index}/{total} |
| `ai.backToReview` | 返回复盘 | Back to review | Về phần xem lại |
| `ai.panel.title` | 局势分析 | Position analysis | Phân tích thế cờ |
| `ai.panel.on` | 已开启 | On | Đang bật |
| `ai.panel.off` | 已关闭 | Off | Đang tắt |
| `ai.mate` | 杀棋 {n} | Mate in {n} | Bí sau {n} nước |
| `ai.eval.label` | 局势评分：{label} | Evaluation: {label} | Đánh giá: {label} |
| `ai.best.ended` | 本局已结束，可打开棋谱逐步复盘。 | The game is over. Open the move list to go through it move by move. | Ván đã kết thúc. Mở biên bản để xem lại từng nước. |
| `ai.best.recommended` | 推荐：{move} | Best: {move} | Gợi ý: {move} |
| `ai.best.searching` | 正在计算推荐走法… | Working out a recommendation… | Đang tính nước gợi ý… |
| `ai.best.idle` | 落子后自动更新分析 | The analysis updates after each move | Phân tích cập nhật sau mỗi nước đi |
| `ai.depth` | 搜索深度 {depth}{busy} ·  | Search depth {depth}{busy} ·  | Độ sâu {depth}{busy} ·  |
| `ai.depth.busy` |  · 计算中 |  · calculating |  · đang tính |
| `ai.disclaimer` | 评分为引擎估计，不代表胜率。 | Scores are engine estimates, not win probabilities. | Điểm là ước tính của máy, không phải xác suất thắng. |
| `ai.panel.hint` | 开启后显示局势评分和推荐走法。 | Turn this on to see the evaluation and recommended moves. | Bật lên để xem đánh giá thế cờ và nước gợi ý. |
| `ai.player.computer` | 电脑棋手 | Computer player | Kỳ thủ máy |
| `ai.engineCredit` | 本地引擎 | Local engine | Máy cờ chạy trên thiết bị |
| `ai.license` | 源码与许可 | Source and license | Mã nguồn và giấy phép |
| `ai.mobile.eval` | 查看局势分析详情 | Show evaluation details | Xem chi tiết phân tích |
| `ai.mobile.over` | 本局结束 | Game over | Ván đã kết thúc |
| `ai.mobile.off` | 局势分析已关闭 | Analysis is off | Phân tích đang tắt |
| `ai.mobile.best` | 推荐 {move} | Best {move} | Gợi ý {move} |
| `ai.mobile.analyzing` | 分析中… | Analyzing… | Đang phân tích… |
| `ai.mobile.details` | 查看详情 | Details | Chi tiết |
| `ai.dock.toolbar` | 人机对局工具栏 | Game toolbar | Thanh công cụ ván với máy |
| `ai.dock.analysisOn` | 分析已开 | Analysis on | Đang phân tích |
| `ai.dock.analysisOff` | 开启分析 | Turn on analysis | Bật phân tích |
| `ai.sheet.moves.description` | 点击着法回看局面，返回对局后继续练习。 | Tap a move to see that position. Go back to the game to keep practicing. | Chạm vào một nước để xem thế cờ lúc đó. Về ván cờ để luyện tiếp. |
| `ai.sheet.eval.title` | 局势与推荐 | Evaluation and advice | Đánh giá và gợi ý |
| `ai.sheet.eval.branch` | 当前独立推演局面的分析 | Analysis of the position you are exploring | Phân tích thế cờ bạn đang thử |
| `ai.sheet.eval.review` | 当前复盘局面的分析 | Analysis of the position under review | Phân tích thế cờ đang xem lại |
| `ai.sheet.eval.live` | 当前对局的分析 | Analysis of the current game | Phân tích ván cờ hiện tại |
| `ai.setup.close.started` | 关闭设置 | Close settings | Đóng cài đặt |
| `ai.setup.close` | 退出人机设置 | Leave the computer game setup | Rời phần thiết lập ván với máy |
| `ai.setup.title` | 和 AI 下盘棋 | Play a game against the computer | Chơi một ván với máy |
| `ai.setup.replaces` | 开始后会替换当前练习棋局。 | Starting will replace your current practice game. | Bắt đầu sẽ thay thế ván luyện tập hiện tại. |
| `ai.setup.side` | 我方执子 | You play | Bạn cầm |
| `ai.setup.red` | 执红 · 先手 | Red · moves first | Đỏ · đi trước |
| `ai.setup.black` | 执黑 · 后手 | Black · moves second | Đen · đi sau |
| `ai.setup.level` | 棋手难度 | Difficulty | Độ khó |
| `ai.setup.note` | 悔棋会退回到你上一次落子前；已结束的对局会自动保存在当前浏览器，未结束的棋局仅保留在当前页面。 | Undo takes you back to before your last move. Finished games are saved in this browser automatically; a game in progress stays on this page only. | Đi lại sẽ đưa bạn về trước nước đi gần nhất của bạn. Ván đã kết thúc được tự động lưu trên trình duyệt này; ván đang chơi chỉ giữ trên trang này. |
| `ai.setup.reload` | 重新加载棋手 | Reload the engine | Tải lại máy cờ |
| `ai.setup.start` | 开始对弈 | Start playing | Bắt đầu chơi |
| `ai.setup.continue` | 继续当前对局 | Continue the current game | Tiếp tục ván hiện tại |
| `ai.resign.body` | 结束本局练习。之后仍可悔棋继续或重新开局。 | This ends the practice game. You can still undo and play on, or start a new game. | Ván luyện tập sẽ kết thúc. Sau đó bạn vẫn có thể đi lại để chơi tiếp, hoặc bắt đầu ván mới. |
| `ai.resign.keep` | 继续对弈 | Keep playing | Chơi tiếp |

### 局势评语与分数

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `eval.waiting` | 等待分析 | Waiting for analysis | Đang chờ phân tích |
| `eval.redMate` | 红方有杀棋 | Red has a mating attack | Đỏ có đòn chiếu bí |
| `eval.blackMate` | 黑方有杀棋 | Black has a mating attack | Đen có đòn chiếu bí |
| `eval.ended` | 已到终局 | The game is over | Ván đã kết thúc |
| `eval.even` | 局势均衡 | Roughly equal | Thế cờ cân bằng |
| `eval.slight` | {side}略优 | {side} is slightly better | {side} hơi ưu thế |
| `eval.clear` | {side}明显占优 | {side} is clearly better | {side} ưu thế rõ rệt |
| `score.analyzing` | 分析中 | Analyzing… | Đang phân tích… |
| `score.draw` | 和棋 | Draw | Hòa |
| `score.win` | {side}胜 | {side} wins | {side} thắng |
| `score.mate` | {side}{n}步杀 | {side} mates in {n} | {side} chiếu bí sau {n} nước |
| `score.even` | 均势 | Even | Cân bằng |
| `score.edge.label` | {side}优 | {side} | {side} |
| `score.edge.value` | {value} | +{value} | +{value} |

## 复盘

### 复盘页

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `review.title` | 复盘分析 | Game review | Xem lại ván cờ |
| `review.exit.club` | 返回棋社 | Back to the lobby | Về sảnh |
| `review.explore` | 从这里推演 | Explore from here | Thử nước từ đây |
| `review.tab.chart` | 局势图 | Chart | Biểu đồ |
| `review.tab.analysis` | 分析 | Analysis | Phân tích |
| `review.tab.report` | 报告 | Report | Báo cáo |
| `review.tab.practice` | 练习 | Practice | Luyện tập |
| `review.tabs` | 复盘内容 | Review sections | Các phần xem lại |
| `review.preparing` | 正在准备引擎… | Getting the engine ready… | Đang chuẩn bị máy cờ… |
| `review.analyzing` | 引擎分析中 {done} / {total} | Engine analyzing {done} / {total} | Máy đang phân tích {done} / {total} |
| `review.interrupted` | 分析中断 | The analysis was interrupted | Phân tích bị gián đoạn |
| `review.retry` | 重试 | Retry | Thử lại |
| `review.start` | 开局 · {score} | Start · {score} | Đầu ván · {score} |
| `phase.opening` | 开局 | Opening | Khai cuộc |
| `phase.middle` | 中局 | Middlegame | Trung cuộc |
| `phase.end` | 残局 | Endgame | Tàn cuộc |
| `line.pause` | 暂停变化 | Pause the line | Tạm dừng biến |
| `line.play` | 播放变化 | Play the line | Chạy biến |
| `line.prev` | 变化上一着 | Previous move in the line | Nước trước trong biến |
| `line.next` | 变化下一着 | Next move in the line | Nước sau trong biến |
| `line.back` | 回到实战局面 | Back to the game position | Về thế cờ thực chiến |
| `review.problem` | 问题在哪 | What went wrong | Sai ở đâu |
| `review.why` | 为什么推荐{move} | Why {move} is better | Vì sao {move} tốt hơn |
| `review.uncertain` | 没有找到明确的战术原因，以上是引擎对局面的判断。 | No clear tactical reason was found; the above is the engine's judgment of the position. | Không tìm thấy lý do chiến thuật rõ ràng; trên đây là đánh giá của máy về thế cờ. |
| `review.empty.start` | 在局势图上点一步，或按「下一步」开始逐步分析。 | Tap a move on the chart, or press “Next” to go through the game move by move. | Chạm một nước trên biểu đồ, hoặc bấm “Nước sau” để xem lần lượt từng nước. ⚑ *引号里是「下一步」按钮（review.nav.next）的文字，两处要一致* |
| `review.empty.pending` | 这一步还在分析，稍等片刻。 | This move is still being analyzed. One moment. | Nước này vẫn đang được phân tích. Chờ một chút. |
| `review.played` | 实战 | Played | Thực chiến |
| `review.best` | 推荐 | Best | Gợi ý |
| `review.engineChoice` | 引擎首选 | Engine's top choice | Lựa chọn hàng đầu của máy |
| `review.same` | 与实战相同 | Same as played | Trùng với nước đã đi |
| `review.nav.start` | 回到开局 | Go to the start | Về đầu ván |
| `review.nav.prev` | 上一步 | Previous | Nước trước |
| `review.nav.next` | 下一步 | Next | Nước sau |
| `review.nav.end` | 到终局 | Go to the end | Đến cuối ván |

### 着法评级

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `rating.inaccuracy` | 中 | ?! | ?! |
| `rating.mistake` | 差 | ? | ? |
| `rating.blunder` | 错 | ?? | ?? |
| `rating.missed-mate` | 漏杀 | Missed mate | Lỡ bí ⚑ *为版面缩短：着法旁的小徽章；完整说法见 .long* |
| `rating.allowed-mate` | 送杀 | Allowed mate | Để bị bí ⚑ *为版面缩短：着法旁的小徽章；完整说法见 .long* |
| `rating.inaccuracy.long` | 中 | Inaccuracy | Thiếu chính xác |
| `rating.mistake.long` | 差 | Mistake | Sai lầm |
| `rating.blunder.long` | 错 | Blunder | Sai lầm nghiêm trọng ⚑ *错 / 差 / 中 三档：Sai lầm nghiêm trọng / Sai lầm / Thiếu chính xác* |
| `rating.missed-mate.long` | 漏杀 | Missed mate | Bỏ lỡ chiếu bí |
| `rating.allowed-mate.long` | 送杀 | Allowed mate | Để bị chiếu bí |

### 报告

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `report.points` | {v}分 | {v} pts | {v} điểm |
| `report.notReached` | 未进入 | Not reached | Chưa tới |
| `report.overall` | 综合表现 | Overall | Tổng thể |
| `report.phaseScore` | {phase}评分 | {phase} score | Điểm {phase} |
| `report.counts` | 错 / 差 / 中 | Blunders / Mistakes / Inaccuracies | Nghiêm trọng / Sai lầm / Thiếu chính xác ⚑ *错/差/中三档评级的总称，请看是否自然* |
| `report.missedMates` | 漏杀 | Missed mates | Bỏ lỡ chiếu bí |
| `report.mistakes` | {side}失误 | {side} mistakes | Lỗi của {side} |
| `report.afterAnalysis` | 分析完成后显示 | Shown when the analysis is done | Hiển thị khi phân tích xong |
| `report.none` | 没有明显失误 | No clear mistakes | Không có lỗi rõ ràng |
| `report.note` | 分数为引擎估计，不同设备和搜索时间会略有差异。 | Scores are engine estimates and vary slightly with device and search time. | Điểm là ước tính của máy, có thể chênh lệch đôi chút tùy thiết bị và thời gian tính. |

### 练习

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `practice.pick` | 选一道题，回到当时的局面重新走。 | Pick a puzzle to go back to that position and play it again. | Chọn một bài để trở lại thế cờ đó và đi lại. |
| `practice.solved` | 正确！{move} 正是引擎首选。 | Correct! {move} is the engine's top choice. | Đúng! {move} chính là lựa chọn hàng đầu của máy. |
| `practice.revealed` | 答案：{move} | Answer: {move} | Đáp án: {move} |
| `practice.wrong` | 这步不是引擎首选，再想想。 | That is not the engine's top choice. Think again. | Đây không phải lựa chọn hàng đầu của máy. Nghĩ thêm nhé. |
| `practice.turn` | 轮到{side}走：找出比实战更好的一步。 | {side} to move: find a better move than the one played. | Lượt {side}: tìm nước tốt hơn nước đã đi. |
| `practice.side` | 练习哪一方的失误 | Whose mistakes to practice | Luyện lỗi của bên nào |
| `practice.sideOption` | {side}失误 {n} | {side} mistakes: {n} | Lỗi của {side}: {n} |
| `practice.choose` | 选择题目 | Choose a puzzle | Chọn bài |
| `practice.question` | 第 {i}/{total} 题 · {num} {move}（{rating}） | Puzzle {i}/{total} · {num} {move} ({rating}) | Bài {i}/{total} · {num} {move} ({rating}) |
| `practice.afterAnalysis` | 分析完成后出题。 | Puzzles appear when the analysis is done. | Bài tập sẽ có khi phân tích xong. |
| `practice.noMistakes` | {side}没有明显失误。 | {side} has no clear mistakes. | {side} không có lỗi rõ ràng. |
| `practice.start` | 开始练习 | Start practicing | Bắt đầu luyện |
| `practice.prev` | 上一着 | Previous move | Nước trước |
| `practice.next` | 下一着 | Next move | Nước sau |
| `practice.pause` | 暂停 | Pause | Tạm dừng |
| `practice.play` | 播放 | Play | Chạy |
| `practice.endDemo` | 结束演示 | End demo | Kết thúc minh họa |
| `practice.again` | 再做一次 | Try again | Làm lại |
| `practice.demo` | 演示变化 | Show the line | Xem biến |
| `practice.hint` | 提示 | Hint | Gợi ý |
| `practice.answer` | 答案 | Answer | Đáp án |
| `practice.nextPuzzle` | 下一题 | Next puzzle | Bài tiếp |
| `practice.lastPuzzle` | 最后一题 | Last puzzle | Bài cuối |

### 局势图

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `chart.red` | 红优 {scale} | Red +{scale} | Đỏ +{scale} |
| `chart.black` | 黑优 {scale} | Black +{scale} | Đen +{scale} |
| `chart.dot` | 第 {ply} 步 · {rating} | Move {ply} · {rating} | Nước {ply} · {rating} |
| `chart.range` | 局势图：选择步数 | Evaluation chart: choose a move | Biểu đồ thế cờ: chọn nước |
| `chart.value` | 第 {ply} 步 · {score} | Move {ply} · {score} | Nước {ply} · {score} |
| `chart.start` | 开局 | Start | Đầu ván |
| `chart.ply` | 第 {ply} / {total} 步 | Move {ply} / {total} | Nước {ply} / {total} |
| `chart.bar` | 局势：{score} | Position: {score} | Thế cờ: {score} |

### 整局分析

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `analysis.title` | 整局分析 | Whole-game analysis | Phân tích cả ván |
| `analysis.stopping` | 正在停止… | Stopping… | Đang dừng… |
| `analysis.cancel` | 取消 | Cancel | Hủy |
| `analysis.loadingCache` | 读取缓存… | Loading cache… | Đang đọc bộ nhớ đệm… |
| `analysis.done` | 已完成 | Done | Xong |
| `analysis.continue` | 继续分析 | Continue | Tiếp tục |
| `analysis.start` | 开始分析 | Start | Bắt đầu |
| `analysis.progress.label` | 整局分析进度 | Analysis progress | Tiến độ phân tích |
| `analysis.readingCache` | 正在读取缓存 | Reading the cache | Đang đọc bộ nhớ đệm |
| `analysis.noMoves` | 本局没有可分析的着法 | This game has no moves to analyze | Ván này không có nước nào để phân tích |
| `analysis.cancelled` | 已取消 ·  | Cancelled ·  | Đã hủy ·  |
| `analysis.running` | 分析中 ·  | Analyzing ·  | Đang phân tích ·  |
| `analysis.progress.other` | {prefix}{done} / {total} 步 | {prefix}{done} / {total} moves | {prefix}{done} / {total} nước |
| `analysis.progress.one` | {prefix}{done} / {total} 步 | {prefix}{done} / {total} move | {prefix}{done} / {total} nước |
| `analysis.cache.read` | 暂时无法读取缓存，可直接分析。 | Cannot read the cache right now, but you can still analyze. | Tạm thời không đọc được bộ nhớ đệm, nhưng vẫn phân tích được. |
| `analysis.cache.write` | 结果已保留在本页，暂时无法写入缓存。 | The results stay on this page, but cannot be saved to the cache right now. | Kết quả vẫn giữ trên trang này, nhưng tạm thời không lưu được vào bộ nhớ đệm. |
| `analysis.note` | 评级为引擎估计，未标记的着法不显示徽章。 | Ratings are engine estimates; moves without a mark get no badge. | Xếp loại là ước tính của máy; nước không được đánh dấu thì không có huy hiệu. |

## 讲解

### 讲解模板（{参数} 由程序填入着法、棋子和分数）

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `list.moves` | ， | ,  | ,  |
| `list.pieces` | 、 | ,  | ,  |
| `explain.mateAgainst` | 这步之后{side}有{n}步杀。 | This allows {side} to mate in {n}. | Nước này để {side} chiếu bí sau {n} nước. |
| `explain.mateAgainst.line` | 这步之后{side}有{n}步杀：{line}。 | This allows {side} to mate in {n}: {line}. | Nước này để {side} chiếu bí sau {n} nước: {line}. |
| `explain.missedMate` | 错过了杀棋。 | This misses a forced mate. | Nước này bỏ lỡ một đòn chiếu bí. |
| `explain.mateLine` | {first}起{n}步成杀：{line}。 | A mate in {n} was available, starting with {first}: {line}. | Đã có đòn chiếu bí sau {n} nước, bắt đầu bằng {first}: {line}. |
| `explain.hung.free` | {move}把{piece}走到了{attacker}可以白吃的位置。 | {move} puts the {piece} where the {attacker} can capture it for free. | {move} đưa {piece} tới chỗ {attacker} có thể ăn không mất gì. |
| `explain.hung.trade` | {move}把{piece}走到了{attacker}能换掉并得子的位置。 | {move} puts the {piece} where the {attacker} can trade it off and come out ahead. | {move} đưa {piece} tới chỗ {attacker} có thể đổi quân mà vẫn được lợi. |
| `explain.ignored` | {side}已经在捉{victim}，这步没有应对。 | {side} was already attacking the {victim}, and this move does not deal with it. | {side} đang bắt {victim}, nhưng nước này không xử lý điều đó. |
| `explain.unprotected` | {piece}走开后，{victim}失去保护，{take} | With the {piece} gone, the {victim} is no longer protected. {take} | Khi {piece} rời đi, {victim} không còn được bảo vệ. {take} |
| `explain.exposed` | 这步之后{victim}暴露在{attacker}的攻击下，{take} | After this move the {victim} is exposed to the {attacker}. {take} | Sau nước này, {victim} bị {attacker} tấn công. {take} |
| `explain.take` | {side}可以{move}吃掉它。 | {side} can capture it with {move}. | {side} có thể ăn nó bằng {move}. |
| `explain.missedCapture` | 错过了得子的机会：{move}可以吃掉{piece}。 | This misses a chance to win material: {move} captures the {piece}. | Nước này bỏ lỡ cơ hội được quân: {move} ăn được {piece}. |
| `explain.loses.other` | 按引擎的应对（{line}），{side}净亏约{points}分子力：{pieces}。 | In the engine's reply ({line}), {side} ends up about {points} points down in material: {pieces}. | Theo cách đáp của máy ({line}), {side} mất khoảng {points} điểm quân: {pieces}. |
| `explain.loses.one` | 按引擎的应对（{line}），{side}净亏约{points}分子力：{pieces}。 | In the engine's reply ({line}), {side} ends up about {points} point down in material: {pieces}. | Theo cách đáp của máy ({line}), {side} mất khoảng {points} điểm quân: {pieces}. |
| `explain.escape` | {move}把被捉的{piece}走到了安全的位置。 | {move} moves the attacked {piece} to safety. | {move} đưa {piece} đang bị bắt tới chỗ an toàn. |
| `explain.protect` | {move}保住了{piece}。 | {move} saves the {piece}. | {move} giữ được {piece}. |
| `explain.check` | {move}将军，先手逼{side}应将。 | {move} gives check and keeps the initiative, forcing {side} to answer. | {move} chiếu tướng, giữ thế chủ động và buộc {side} phải đỡ. |
| `explain.fork` | {move}同时捉{a}和{b}，{side}难以兼顾。 | {move} attacks the {a} and the {b} at once, and {side} cannot save both. | {move} bắt đôi {a} và {b} cùng lúc, {side} không giữ được cả hai. |
| `explain.gain.other` | 按推荐的变化（{line}），{side}净得约{points}分子力。 | In the recommended line ({line}), {side} nets about {points} points of material. | Theo biến gợi ý ({line}), {side} được khoảng {points} điểm quân. |
| `explain.gain.one` | 按推荐的变化（{line}），{side}净得约{points}分子力。 | In the recommended line ({line}), {side} nets about {points} point of material. | Theo biến gợi ý ({line}), {side} được khoảng {points} điểm quân. |
| `explain.noLoss` | 这步没有直接丢子，但引擎认为局面从{from}变为{to}，差别多在子力位置和长远形势。 | This move does not lose material directly, but the engine sees the position going from {from} to {to}. The difference lies mostly in piece placement and the longer-term outlook. | Nước này không trực tiếp mất quân, nhưng máy thấy thế cờ chuyển từ {from} sang {to}. Khác biệt chủ yếu nằm ở vị trí quân và thế cờ lâu dài. |
| `explain.prefers` | 引擎更看好{move}：走后{score}，主要变化是{line}。 | The engine prefers {move}. Evaluation afterwards: {score}; main line: {line}. | Máy thích {move} hơn. Đánh giá sau đó: {score}; biến chính: {line}. |

## 错误

### 错误提示（err.*）

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `err.room-full` | 棋桌已坐满，你可以观战。 | The table is full, but you can watch. | Bàn cờ đã đủ người, bạn có thể vào xem. |
| `err.spectator` | 你正在观战，只有对局双方可以操作。 | You are watching; only the two players can do that. | Bạn đang xem; chỉ hai người chơi mới làm được việc này. |
| `err.chat-empty` | 请输入消息。 | Type a message first. | Hãy nhập tin nhắn. |
| `err.chat-too-fast` | 发送太快，请稍等片刻。 | You are sending too fast. Wait a moment. | Bạn gửi nhanh quá. Hãy đợi một chút. |
| `err.waiting-for-friend` | 请等待好友入座。 | Wait for your friend to take a seat. | Hãy đợi bạn cờ vào bàn. |
| `err.nothing-to-undo` | 还没有可以悔回的棋。 | There is no move to take back yet. | Chưa có nước nào để đi lại. |
| `err.no-offer-to-cancel` | 没有可撤回的邀请。 | There is no invitation to withdraw. | Không có lời mời nào để rút lại. |
| `err.no-offer-to-answer` | 没有等待你回应的请求。 | There is no request waiting for your answer. | Không có đề nghị nào đang chờ bạn trả lời. |
| `err.game-over` | 对局已结束。 | The game is already over. | Ván cờ đã kết thúc. |
| `err.game-finished` | 本局已结束，可以悔棋或再来一局。 | This game is over. You can undo a move or play again. | Ván này đã kết thúc. Bạn có thể đi lại hoặc chơi ván mới. |
| `err.offer-pending` | 请先处理当前邀请。 | Please answer the current invitation first. | Hãy trả lời lời mời hiện tại trước. |
| `err.not-your-turn` | 还没轮到你落子。 | It is not your turn yet. | Chưa đến lượt bạn. |
| `err.illegal-move` | 这一步不符合走棋规则，或会使己方被将军。 | That move breaks the rules or would leave your own General in check. | Nước này không đúng luật, hoặc sẽ để Tướng của bạn bị chiếu. |
| `err.unknown-action` | 未知操作。 | Unknown action. | Thao tác không xác định. |
| `err.bad-room-link` | 房间链接不正确，请重新复制邀请链接。 | That room link is not right. Copy the invite link again. | Liên kết phòng không đúng. Hãy sao chép lại liên kết mời. |
| `err.room-not-found` | 没有找到这间棋室，请核对邀请链接。 | Could not find that room. Check the invite link. | Không tìm thấy phòng cờ này. Hãy kiểm tra liên kết mời. |
| `err.request-too-large` | 请求内容过长。 | The request is too large. | Yêu cầu quá lớn. |
| `err.bad-request` | 请求格式不正确。 | The request was not understood. | Yêu cầu không hợp lệ. |
| `err.bad-clock` | 请选择有效的对局时长。 | Please choose a valid time control. | Hãy chọn thời gian hợp lệ cho ván cờ. |
| `err.room-changed` | 棋局刚有变化，已同步，请再试一次。 | The game just changed and is now in sync. Please try again. | Ván cờ vừa thay đổi và đã được đồng bộ. Hãy thử lại. |
| `err.room-changed-retry` | 棋局刚有变化，请稍后重试。 | The game just changed. Please try again shortly. | Ván cờ vừa thay đổi. Hãy thử lại sau giây lát. |
| `err.opponent-acted` | 对方刚刚进行了操作，已同步，请再试一次。 | Your opponent just acted and the game is now in sync. Please try again. | Đối thủ vừa thao tác và ván cờ đã được đồng bộ. Hãy thử lại. |
| `err.join-failed` | 入座未成功，请重新连接。 | Could not take the seat. Please reconnect. | Chưa vào được bàn. Hãy kết nối lại. |
| `err.connection-lost` | 棋室连接中断，正在重连。 | Lost the connection to the room. Reconnecting… | Mất kết nối với phòng cờ. Đang kết nối lại… |
| `err.action-failed` | 操作未成功。 | That did not go through. | Thao tác chưa thành công. |
| `err.network-unstable` | 网络不稳定，请稍后重试。 | The network looks unstable. Please try again in a moment. | Mạng không ổn định. Hãy thử lại sau giây lát. |
| `err.unavailable` | 棋室暂时连接不上，请稍后重试。 | Cannot reach the game room right now. Please try again shortly. | Tạm thời không kết nối được phòng cờ. Hãy thử lại sau giây lát. |
| `err.origin-mismatch` | 请求来源不匹配。 | The request came from a different origin. | Nguồn gửi yêu cầu không khớp. |
| `err.cross-site` | 请在棋室页面操作。 | Please do this from the game room page. | Hãy thao tác trên trang phòng cờ. |
| `err.sign-in-required` | 请先登录。 | Please sign in first. | Hãy đăng nhập trước. |
| `err.game-not-found` | 找不到这盘对局。 | Could not find that game. | Không tìm thấy ván cờ này. |
| `err.bad-page` | 分页参数无效。 | The paging parameter is not valid. | Tham số phân trang không hợp lệ. |
| `err.bad-game` | 对局数据无效。 | The game data is not valid. | Dữ liệu ván cờ không hợp lệ. |
| `err.missing-game-id` | 缺少对局编号。 | The game id is missing. | Thiếu mã ván cờ. |
| `err.no-such-endpoint` | 接口不存在。 | No such endpoint. | Địa chỉ yêu cầu không tồn tại. |
| `err.engine-unsupported` | 此浏览器无法启动本地棋手，请用新版 Safari、Chrome 或 Edge 打开。 | This browser cannot start the local engine. Please use a recent Safari, Chrome or Edge. | Trình duyệt này không khởi động được máy cờ. Hãy dùng Safari, Chrome hoặc Edge bản mới. |
| `err.engine-timeout` | 引擎加载超时，请重试。 | The engine took too long to load. Please try again. | Máy cờ tải quá lâu. Hãy thử lại. |
| `err.engine-start-failed` | 象棋引擎启动失败，请刷新或更换浏览器。 | The xiangqi engine failed to start. Refresh the page or try another browser. | Không khởi động được máy cờ. Hãy tải lại trang hoặc dùng trình duyệt khác. |
| `err.engine-stopped` | 本地棋手停止了，请重试；手机内存不足时可关闭其他页面。 | The local engine stopped. Please try again; on a phone, closing other tabs frees memory. | Máy cờ đã dừng. Hãy thử lại; trên điện thoại, đóng bớt các trang khác sẽ giải phóng bộ nhớ. |
| `err.search-timeout` | 这次计算超时，请重试。 | This calculation timed out. Please try again. | Lần tính này quá thời gian. Hãy thử lại. |
| `err.search-stop-failed` | 计算未能停止，请重新加载棋手。 | The calculation would not stop. Please reload the engine. | Không dừng được phép tính. Hãy tải lại máy cờ. |
| `err.engine-prepare-failed` | 棋手准备失败，请重试。 | The engine failed to get ready. Please try again. | Máy cờ chưa sẵn sàng được. Hãy thử lại. |
| `err.engine-no-move` | 棋手未返回可用走法，棋局已保留，请重试。 | The engine returned no usable move. Your game is kept; please try again. | Máy cờ không trả về nước đi dùng được. Ván cờ vẫn được giữ; hãy thử lại. |
| `err.search-failed` | 计算失败，请重试。 | The calculation failed. Please try again. | Tính toán thất bại. Hãy thử lại. |
| `err.archive-load-failed` | 无法读取这盘对局 | Could not load this game. | Không đọc được ván cờ này. |
| `err.local-game-missing` | 找不到这盘本地对局，可能已被清理或保存在另一台设备上。 | Could not find this game on this device. It may have been cleared, or saved on another device. | Không tìm thấy ván cờ này trên thiết bị. Có thể nó đã bị xóa, hoặc được lưu trên thiết bị khác. |
| `err.local-storage-unreadable` | 当前浏览器无法读取本地对局 | This browser cannot read saved games. | Trình duyệt này không đọc được các ván đã lưu. |
| `err.archive-invalid` | 存档中有无效着法 | This saved game contains an invalid move. | Ván đã lưu có nước đi không hợp lệ. |
| `err.archive-mismatch` | 存档的棋谱与终局不一致 | The saved moves do not match the saved result. | Các nước đã lưu không khớp với kết quả đã lưu. |
| `err.analysis-incomplete-score` | 引擎未返回完整搜索评分 | The engine did not return a complete score. | Máy cờ không trả về điểm đánh giá đầy đủ. |
| `err.analysis-bad-mate` | 非终局的杀棋评分无效 | The engine returned an invalid mate score. | Máy cờ trả về điểm chiếu bí không hợp lệ. |
| `err.analysis-no-score` | 引擎未返回可用评分 | The engine returned no usable score. | Máy cờ không trả về điểm đánh giá dùng được. |
| `err.analysis-ply-incomplete` | 第 {n} 步未获得完整评分，请重试 | Move {n} did not get a complete score. Please try again. | Nước {n} chưa có điểm đánh giá đầy đủ. Hãy thử lại. |
| `err.analysis-mismatch` | 分析结果与存档棋谱不匹配 | The analysis does not match the saved game. | Kết quả phân tích không khớp với ván đã lưu. |
| `err.analysis-engine-failed` | 引擎分析失败 | The engine analysis failed. | Máy cờ phân tích thất bại. |
| `err.analysis-failed` | 整局分析失败，请重试。 | The whole-game analysis failed. Please try again. | Phân tích cả ván thất bại. Hãy thử lại. |

## 设置

### 对局设置与语言

| 键 | 中文 | English | Tiếng Việt |
|---|---|---|---|
| `locale.label` | 语言 | Language | Ngôn ngữ |
| `fx.title` | 对局设置 | Game settings | Cài đặt ván cờ |
| `fx.sound` | 音效 | Sound | Âm thanh |
| `fx.hints` | 走子提示 | Move hints | Gợi ý nước đi |
| `fx.moveEffects` | 吃子/将军动画 | Capture and check effects | Hiệu ứng ăn quân và chiếu |
| `fx.resultEffects` | 绝杀/结算动画 | Checkmate and result effects | Hiệu ứng chiếu bí và kết quả |

