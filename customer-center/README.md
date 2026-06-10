# TikRapid 客户中心 MVP

独立 Next.js 应用，面向 TikRapid 客户服务管理：管理员创建客户和服务套餐，客户查看套餐、连接信息、教程、提交工单，并完成首次登录合规确认。

## 本地运行

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

默认管理员由 `.env` 里的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 创建。

## Docker 部署

```bash
docker compose up --build
```

首次启动会自动执行 Prisma migrate deploy。生产环境请务必修改：

- `AUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- PostgreSQL 密码

## 安全边界

- 不开放自由注册，客户账号只能由管理员创建。
- 客户看不到真实上游资源、服务器成本、供应商信息。
- 系统不保存客户平台账号密码。
- 管理员后台和客户后台都做了角色权限控制。
- 工单图片上传到 `UPLOAD_DIR`，Docker 中挂载为持久化 volume。
