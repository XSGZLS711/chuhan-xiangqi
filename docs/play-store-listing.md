# Google Play 商店页文案

楚汉棋社在 Play Console「Grow users → Store presence → Main store listing」（主商店页）里要填的文字。默认语言建议用 English (United States)，再加 中文（简体）和 Tiếng Việt 两个翻译。字数是 Play 的上限：标题 30、简短说明 80、完整说明 4000（中文一个字算一个）。

依据：README「已实现」、`ROADMAP.md`、词典里已经定下的说法（难度档「入门 / 进阶 / 挑战」、「独立推演」、「导出棋谱」等，英文和越南语照 `lib/locales/en.ts`、`vi.ts` 的译法）。照 Play 的元数据政策，标题里不写「免费」「最好」之类；完整说明只写已经做好的功能。越南语请越南朋友校对。

商店页另外还要：512×512 图标（`public/icons/icon-512.png`）、1024×500 置顶大图、至少 2 张手机截图；联系邮箱 `feedback@chuhanxiangqi.com`、网站 `https://chuhanxiangqi.com`、类别「游戏 → 棋类」（Board）。

## English (United States)

标题（29 字符）：

```text
Chuhan Xiangqi: Chinese Chess
```

简短说明（77 字符）：

```text
Play xiangqi with friends by link or against the computer. Review every move.
```

完整说明（1314 字符）：

```text
Chuhan Xiangqi is a xiangqi (Chinese chess) site that opens full screen as an app on your phone. No sign-up needed: open it and play.

Play a friend
• Open a room and send the link. Your friend opens it and takes a seat; anyone after that watches.
• Untimed, or 10, 20 or 30 minutes each, with the clock kept on the server.
• Chat during the game, undo whenever you like, and explore from any position without your opponent seeing it.
• Export the game record to keep it.

Play the computer
• Three levels: Beginner, Intermediate and Challenge. Play Red or Black.
• The engine runs on your phone, so once you have opened it, it plays offline too.
• Turn on the analysis to see the evaluation and the recommended move.

Review every move
• After a game, open the review: an evaluation chart, a rating for each move, missed mates and moves that allow mate.
• The review explains mistakes, such as a piece left hanging, a threat not met or a mate missed, and plays out the better line on the board.
• Practice the positions you got wrong as often as you like.

And
• Unlimited undo, analysis and practice.
• Play without an account, or sign in with Google to see your finished games on any device.
• In English, Chinese and Vietnamese, with the notation to match: WXF, Chinese or Vietnamese.
• No ads, nothing to buy.
```

## 中文（简体）

标题（11 字符）：

```text
楚汉棋社 · 中国象棋
```

简短说明（35 字符）：

```text
发链接约好友下象棋，也能和 AI 练习。无限悔棋、独立推演、逐步复盘。
```

完整说明（468 字符）：

```text
楚汉棋社是一个中国象棋网站，装成 App 后在手机上全屏打开。不用注册，打开就能下。

好友对弈
• 建一个棋室，把链接发给好友，打开即可入座；之后进来的人可以观战。
• 不限时，或每方 10、20、30 分钟，由服务器计时。
• 对局中可以聊天，可以随时悔棋，也可以从任意局面独立推演，推演不会发给对手。
• 棋谱可以导出保存。

人机练习
• 入门、进阶、挑战三档，执红执黑都可以。
• 象棋引擎在你的手机上运行，打开过一次之后断网也能下。
• 打开局势分析，可以看到评分和推荐走法。

逐步复盘
• 下完一局，一键进入复盘：局势曲线、每一步的评级、漏杀和送杀。
• 复盘会讲解失误，比如丢子、没有应对的威胁、错过的杀棋，并在棋盘上演示推荐的变化。
• 下错的局面可以拿来反复练习。

还有
• 悔棋、分析、练习都不限次数。
• 不登录也能下；用 Google 登录后，下完的对局换台设备也能看到。
• 中文、English、Tiếng Việt 三种界面，记谱跟着语言走：中文记谱、WXF、越南记谱。
• 没有广告，没有付费内容。
```

## Tiếng Việt

标题（25 字符）：

```text
Chuhan Xiangqi – Cờ tướng
```

简短说明（74 字符）：

```text
Gửi liên kết mời bạn chơi cờ tướng, luyện với máy và xem lại từng nước đi.
```

完整说明（1331 字符）：

```text
Chuhan Xiangqi là trang cờ tướng, cài thành ứng dụng thì mở toàn màn hình trên điện thoại. Không cần đăng ký, mở ra là chơi.

Chơi với bạn
• Mở một bàn, gửi liên kết cho bạn; bạn mở ra là vào bàn, người đến sau thì xem.
• Không giới hạn thời gian, hoặc mỗi bên 10, 20, 30 phút, đồng hồ do máy chủ tính.
• Trò chuyện trong ván, đi lại bất cứ lúc nào, tự do thử nước từ bất kỳ thế cờ nào mà đối thủ không thấy.
• Có thể xuất biên bản ván cờ để lưu.

Chơi với máy
• Ba mức: Nhập môn, Trung bình, Thử thách. Cầm quân Đỏ hay Đen đều được.
• Máy cờ chạy ngay trên điện thoại của bạn, mở một lần rồi thì không có mạng vẫn chơi được.
• Bật phân tích để xem đánh giá thế cờ và nước gợi ý.

Xem lại từng nước
• Chơi xong, mở phần xem lại: biểu đồ thế cờ, đánh giá từng nước, những lần bỏ lỡ chiếu bí và những nước để bị chiếu bí.
• Phần xem lại giải thích các nước sai, như bỏ quân, không đỡ đòn đe dọa, bỏ lỡ chiếu bí, và bày lại biến tốt hơn trên bàn cờ.
• Luyện lại những thế cờ đã đi sai, bao nhiêu lần cũng được.

Thêm nữa
• Đi lại, phân tích và luyện tập không giới hạn.
• Không cần tài khoản; đăng nhập bằng Google để xem lại các ván đã chơi trên mọi thiết bị.
• Giao diện tiếng Việt, tiếng Anh và tiếng Trung, ký hiệu nước đi theo ngôn ngữ: ký hiệu Việt Nam, WXF hoặc ký hiệu Trung Quốc.
• Không quảng cáo, không có gì phải trả tiền.
```
