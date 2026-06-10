import Link from "next/link";
import { createCustomerAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requireAdmin();

  return (
    <AppShell title="创建客户" subtitle="客户账号只能由管理员创建" nav={[{ href: "/admin", label: "返回后台" }]}>
      <form action={createCustomerAction} className="card grid gap-4 p-5 md:grid-cols-2">
        <label className="field">
          客户姓名
          <input className="input" name="name" required />
        </label>
        <label className="field">
          登录邮箱
          <input className="input" name="email" type="email" required />
        </label>
        <label className="field">
          初始密码
          <input className="input" name="password" type="text" required />
        </label>
        <label className="field">
          公司 / 团队
          <input className="input" name="company" />
        </label>
        <label className="field">
          电话
          <input className="input" name="phone" />
        </label>
        <label className="field">
          微信
          <input className="input" name="wechat" />
        </label>
        <label className="field">
          Telegram
          <input className="input" name="telegram" />
        </label>
        <label className="field md:col-span-2">
          内部备注
          <textarea className="input min-h-24" name="note" />
        </label>
        <div className="flex gap-3 md:col-span-2">
          <button className="btn btn-primary" type="submit">
            创建客户
          </button>
          <Link className="btn" href="/admin">
            取消
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
