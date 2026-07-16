# 晴天生活

一款可直接在浏览器中游玩的原创 3D 卡通生活模拟游戏。你可以捏出自己的居民，在晴天市散步、交朋友、吃饭、休息、参加广场活动，并把每天的故事保存在浏览器中。

## 在线游玩

- [GitHub Pages 版](https://jefferyhw2025-cpu.github.io/sunny-side-stories/)
- [晴天生活原站](https://sunny-side-stories-cn.jefferyhw2025.chatgpt.site/)

## 游戏特色

- 自由捏人：肤色、脸型、发型、五官、服装与个性均可组合
- 3D 小镇：公寓、广场、咖啡店、商铺、喷泉和多层远景
- 居民生活：散步、聊天、吃饭、休息、互动和情绪动画
- 日常循环：天气、日期、金币、精力、心情与友谊会持续变化
- 本地存档：游戏进度自动保存在当前浏览器中
- 响应式界面：支持电脑与移动设备浏览器

## 本地运行

需要 Node.js 22.13 或更高版本，以及 pnpm。

```bash
pnpm install
pnpm dev
```

构建原站版本：

```bash
pnpm build
```

构建 GitHub Pages 静态版本：

```bash
pnpm build:github
```

静态产物会生成到 `github-dist/`。推送到 `main` 后，GitHub Actions 会自动构建并发布 GitHub Pages。

## 美术与版权说明

本项目采用原创角色、建筑与界面素材，目标是营造温暖、轻松的生活模拟氛围；未使用任天堂或《动物森友会》的角色、模型、贴图、音乐及商标素材。
