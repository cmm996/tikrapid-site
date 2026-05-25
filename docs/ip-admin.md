# IP 管理后台

页面地址：

```text
/ip-admin.html
```

接口会自动创建 `ip_rules` 表，前提是 Cloudflare Pages 已经绑定 D1 数据库为 `DB`。

建议在 Cloudflare Pages 的环境变量里设置：

```text
ADMIN_TOKEN=换成一串强随机字符
```

设置后，`ip-admin.html` 右上角填入同一个 token 才能管理 IP。

## API

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
