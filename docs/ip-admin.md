# IP 管理后台

页面地址：

```text
/ip-admin
```

旧地址 `/ip-admin.html` 只做跳转，不再包含后台页面内容。真正后台页面由 Cloudflare Pages Function 返回，并使用 `ADMIN_TOKEN` 做 Basic Auth 保护。

接口会自动创建 `ip_rules` 表，前提是 Cloudflare Pages 已经绑定 D1 数据库为 `DB`。

建议在 Cloudflare Pages 的环境变量里设置：

```text
ADMIN_TOKEN=换成一串强随机字符
```

设置后，打开 `/ip-admin` 时浏览器会弹出登录框。用户名可随便填，密码填写 `ADMIN_TOKEN`。进入页面后，右上角也可以保存同一个 token，用于显式调用管理 API。

## API

后台支持给每条 IP / CIDR 设置 `business_type` 业务类型、`price` 续费价格、`contact` 客户联系方式、`source` IP 段来源、`expires_at` 到期时间。到期时间格式为 `YYYY-MM-DD`，不填写表示长期有效。到期后的记录会在后台显示为“已到期”，并且 `/api/ip/check` 不会继续放行。

顶部“本月续费金额”会按本月到期的记录汇总 `price` 字段里的金额数字，用来快速查看本月应续费金额。

后台列表会显示剩余天数，并提供快捷续费：

- 续 1 月
- 续 1 季
- 续半年
- 续 1 年

续费会从当前到期日或今天中较晚的日期开始顺延。

管理接口：

```http
GET /api/admin/ips
POST /api/admin/ips
POST /api/admin/ip
```

业务检查接口：

```http
GET /api/ip/check?ip=1.2.3.4
```

返回：

```json
{
  "ip": "1.2.3.4",
  "allowed": true,
  "matched": {
    "id": 1,
    "address": "1.2.3.0/24",
    "label": "example",
    "note": ""
  }
}
```

不传 `ip` 时，会优先读取 `CF-Connecting-IP`、`X-Real-IP`、`X-Forwarded-For`。
