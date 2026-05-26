# 线路质量检测接入说明

本仓库已加入 Cloudflare Pages 原生版线路检测：

- `/check`：客户自助检测页面
- `/api/ip`：出口 IP、国家、城市、ASN、运营商
- `/api/ping`：HTTP 延迟测试
- `/static/test.bin`：下载测速文件，由 Pages Function 动态生成
- `/api/upload-test`：上传测速
- `/api/results`：保存检测结果到 D1
- `/report/{id}`：客户可分享的报告页

## Cloudflare Pages 设置

1. GitHub 仓库连接 Cloudflare Pages，生产分支使用 `main`。
2. 保持现有 D1 绑定名为 `DB`。
3. 部署后访问：

```text
https://go.tikrapid.top/check
```

检测结果会自动创建并写入 D1 表 `check_results`。

## 首页入口

首页保留原来的 ipinfo “检测当前 IP”按钮，同时新增：

```text
线路质量检测 -> /check
```

这样客户可以选择轻量查 IP，也可以做完整线路检测。
