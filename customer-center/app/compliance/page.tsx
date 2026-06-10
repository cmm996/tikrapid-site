import { redirect } from "next/navigation";
import { acceptComplianceAction } from "@/app/actions";
import { requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const user = await requireCustomer();
  const existing = await prisma.complianceConfirmation.findFirst({
    where: { customerId: user.customer.id },
  });
  if (existing) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-10">
      <section className="card p-7">
        <p className="text-sm font-black uppercase text-blue-600">TikRapid</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">服务合规使用告知</h1>
        <div className="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
          <p>本服务用于跨境业务网络环境配置、连接检测、诊断和优化建议。</p>
          <p>请勿将服务用于违法违规用途、平台违规引流、批量骚扰、恶意注册、攻击、诈骗或侵犯他人权益的行为。</p>
          <p>系统不会要求你提交或保存平台账号密码；如需排查，请只提交网络截图、设备状态和问题描述。</p>
          <p>网络环境不能承诺账号结果、播放量、成交、收益或平台权重。账号表现还与内容、设备、账号基础和平台规则有关。</p>
        </div>
        <form action={acceptComplianceAction} className="mt-6 grid gap-4">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm font-bold text-slate-700">
            <input className="mt-1" name="accepted" type="checkbox" required />
            我已阅读并同意按合规方式使用 TikRapid 服务，不会提交平台账号密码或用于违规用途。
          </label>
          <button className="btn btn-primary w-fit" type="submit">
            确认并进入客户中心
          </button>
        </form>
      </section>
    </main>
  );
}
