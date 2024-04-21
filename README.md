<div align="center">

# TRSS-Yunzai ICQQ Plugin

TRSS-Yunzai ICQQ Bot 适配器 插件

[![访问量](https://visitor-badge.glitch.me/badge?page_id=TimeRainStarSky.Yunzai-ICQQ-Plugin&right_color=red&left_text=访%20问%20量)](https://github.com/TimeRainStarSky/Yunzai-ICQQ-Plugin)
[![Stars](https://img.shields.io/github/stars/TimeRainStarSky/Yunzai-ICQQ-Plugin?color=yellow&label=收藏)](../../stargazers)
[![Downloads](https://img.shields.io/github/downloads/TimeRainStarSky/Yunzai-ICQQ-Plugin/total?color=blue&label=下载)](../../archive/main.tar.gz)
[![Releases](https://img.shields.io/github/v/release/TimeRainStarSky/Yunzai-ICQQ-Plugin?color=green&label=发行版)](../../releases/latest)

[![访问量](https://profile-counter.glitch.me/TimeRainStarSky-Yunzai-ICQQ-Plugin/count.svg)](https://github.com/TimeRainStarSky/Yunzai-ICQQ-Plugin)

</div>

## 安装教程

1. 准备：[TRSS-Yunzai](../../../Yunzai)
2. 输入：`#安装ICQQ-Plugin`
3. 输入：`#QQ签名[签名服务器地址]`
4. 输入：`#QQ设置QQ号:密码:登录设备`

## 安装 ICQQ

```sh
cd plugins/ICQQ-Plugin

pnpm login --scope=@icqqjs --auth-type=legacy --registry=https://npm.pkg.github.com

UserName: # 你的 GitHub 账号
Password: # 前往 https://github.com/settings/tokens/new 获取，scopes 勾选 read:packages
E-Mail: # 你的公开邮箱地址

pnpm add icqq@npm:@icqqjs/icqq
```

## 格式示例

- 密码登录：QQ号 `114514` 密码 `1919810` 登录设备 `安卓手机(1)/平板(2)`

```
#QQ设置114514:1919810:2
```

- 扫码登录：QQ号 `114514` 登录设备 `安卓手表(3)`

```
#QQ设置114514::3
```

## 使用教程

- #QQ账号
- #QQ设置 + `QQ号:密码(留空扫码):登录设备:版本号:独立签名地址`
- #QQ签名 + `签名服务器地址`