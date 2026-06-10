import Link from "next/link";
import { redirect } from "next/navigation";
import { createTicketAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { requireCustomer } from "@/lib/auth";
import { daysLeft, displayDate, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerDashboardPage() {
  const user = await requireCustomer();
  const confirmation = await prisma.complianceConfirmation.findFirst({
    where: { customerId: user.customer.id },
    orderBy: { acceptedAt: "desc" },
  });

  if (!confirmation) redirect("/compliance");

  const [services, tickets] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { customerId: user.customer.id },
      orderBy: { expiresAt: "asc" },
    }),
    prisma.ticket.findMany({
      where: { customerId: user.customer.id },
      include: { serviceOrder: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <AppShell
      title="我的客户中心"
      subtitle={`${user.name}，这里查看套餐、连接信息和工单进度`}
      nav={[{ href: "https://go.tikrapid.top/docs", label: "官网教程" }]}
    >
      <section className="grid gap-4 lg:grid-cols-3">
        {services.map((service) => {
          const left = daysLeft(service.expiresAt);
          return (
            <article className="card grid gap-4 p-5" key={service.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="badge">{statusLabel(service.status)}</span>
                  <h2 className="mt-3 text-xl font-black text-slate-950">{service.title}</h2>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-blue-600">{left >= 0 ? left : 0}</p>
                  <p className="text-xs font-bold text-slate-500">剩余天数</p>
                </div>
              </div>
              <dl className="grid gap-2 text-sm text-slate-600">
                <Info label="套餐类型" value={service.packageType} />
                <Info label="目标地区" value={service.targetRegion} />
                <Info label="设备数量" value={`${service.deviceCount} 台`} />
                <Info label="到期时间" value={displayDate(service.expiresAt)} />
              </dl>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-700">连接信息</p>
                {service.subscriptionUrl ? (
                  <a className="mt-2 block break-all text-sm font-bold text-blue-600" href={service.subscriptionUrl} target="_blank" rel="noreferrer">
                    {service.subscriptionUrl}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">管理员暂未填写订阅链接</p>
                )}
                {service.qrCodeUrl ? (
                  <a className="mt-3 inline-flex font-bold text-blue-600" href={service.qrCodeUrl} target="_blank" rel="noreferrer">
                    查看二维码
                  </a>
                ) : null}
              </div>
              {service.instructions ? (
                <div className="rounded-xl border border-slate-200 p-4 text-sm leading-7 text-slate-700">
                  {service.instructions}
                </div>
              ) : null}
            </article>
          );
        })}
        {!services.length ? <div className="card p-5 text-sm text-slate-500">暂未开通服务套餐</div> : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="card p-5">
          <h2 className="text-lg font-black">使用教程</h2>
          <div className="mt-4 grid gap-3">
            <Guide title="开播前检测" text="开播前先检测当前网络环境，确认地区、运营商、延迟和下载稳定性。" />
            <Guide title="设备固定使用" text="一个账号尽量固定设备和地区，避免频繁切换网络环境。" />
            <Guide title="多设备团队" text="团队或多设备使用建议通过路由器/软路由统一接入，便于后期排查。" />
            <Link className="btn btn-primary w-fit" href="https://go.tikrapid.top/docs">
              查看完整教程中心
            </Link>
          </div>
        </div>

        <form action={createTicketAction} className="card grid gap-4 p-5" encType="multipart/form-data">
          <h2 className="text-lg font-black">提交工单</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field">
              关联套餐
              <select className="input" name="serviceOrderId">
                <option value="">不关联</option>
                {services.map((service) => (
                  <option value={service.id} key={service.id}>
                    {service.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              问题类型
              <select className="input" name="issueType" required>
                <option value="连接异常">连接异常</option>
                <option value="直播卡顿">直播卡顿</option>
                <option value="地区不符">地区不符</option>
                <option value="续费/到期">续费/到期</option>
                <option value="其他问题">其他问题</option>
              </select>
            </label>
            <label className="field">
              使用场景
              <select className="input" name="useCase" required>
                <option value="TK 直播">TK 直播</option>
                <option value="短视频矩阵">短视频矩阵</option>
                <option value="跨境电商">跨境电商</option>
                <option value="AI 工具">AI 工具</option>
                <option value="外贸业务">外贸业务</option>
              </select>
            </label>
            <label className="field">
              目标地区
              <input className="input" name="targetRegion" placeholder="日本 / 美国 / 马来西亚" required />
            </label>
            <label className="field">
              设备数量
              <input className="input" name="deviceCount" type="number" min="1" defaultValue="1" required />
            </label>
            <label className="field">
              发生时间
              <input className="input" name="occurredAt" type="datetime-local" required />
            </label>
          </div>
          <label className="field">
            问题描述
            <textarea className="input min-h-28" name="description" placeholder="请说明现象、设备、线路、发生时间，避免提供平台账号密码。" required />
          </label>
          <label className="field">
            上传截图
            <input className="input" name="image" type="file" accept="image/*" />
          </label>
          <button className="btn btn-primary w-fit" type="submit">
            提交工单
          </button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">我的工单</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {tickets.map((ticket) => (
            <article className="p-5" key={ticket.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{ticket.issueType}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {ticket.targetRegion} / {ticket.useCase} / {displayDate(ticket.createdAt)}
                  </p>
                </div>
                <span className="badge">{statusLabel(ticket.status)}</span>
              </div>
              {ticket.adminNote ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">处理备注：{ticket.adminNote}</p> : null}
            </article>
          ))}
          {!tickets.length ? <p className="p-5 text-sm text-slate-500">还没有工单</p> : null}
        </div>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-800">{value}</dd>
    </div>
  );
}

function Guide({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="font-black text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}
