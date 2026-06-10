import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === UserRole.ADMIN ? "/admin" : "/dashboard");
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-7">
        <div className="mb-7">
          <p className="text-sm font-black uppercase tracking-wide text-blue-600">TikRapid</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">客户中心登录</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">客户账号由管理员创建，不开放自由注册。</p>
        </div>

        {params.error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            邮箱或密码不正确
          </div>
        ) : null}

        <form action={loginAction} className="grid gap-4">
          <label className="field">
            邮箱
            <input className="input" name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            密码
            <input className="input" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn btn-primary mt-2" type="submit">
            登录
          </button>
        </form>
      </section>
    </main>
  );
}
