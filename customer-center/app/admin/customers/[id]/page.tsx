import { ServiceStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { createServiceAction, updateCustomerAction, updateServiceAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { dateOnly, displayDate, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      user: true,
      services: { orderBy: { expiresAt: "desc" } },
      tickets: { orderBy: { createdAt: "desc" }, take: 5 },
      complianceConfirmations: { orderBy: { acceptedAt: "desc" }, take: 1 },
    },
  });

  if (!customer) notFound();

  return (
    <AppShell
      title={customer.user.name}
      subtitle={`${customer.user.email} / ${customer.company || "未填写公司"}`}
      nav={[
        { href: "/admin", label: "后台首页" },
        { href: "/admin/tickets", label: "工单" },
      ]}
    >
      <section className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <form action={updateCustomerAction} className="card grid gap-4 p-5">
          <input name="customerId" type="hidden" value={customer.id} />
          <div>
            <h2 className="text-lg font-black">客户信息</h2>
            <p className="mt-1 text-sm text-slate-500">后台只保存联系方式和服务信息，不保存客户平台账号密码。</p>
          </div>
          <label className="field">
            客户姓名
            <input className="input" name="name" defaultValue={customer.user.name} required />
          </label>
          <label className="field">
            登录邮箱
            <input className="input" name="email" type="email" defaultValue={customer.user.email} required />
          </label>
          <label className="field">
            重置密码
            <input className="input" name="password" placeholder="不修改请留空" />
          </label>
          <label className="field">
            公司 / 团队
            <input className="input" name="company" defaultValue={customer.company} />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="field">
              电话
              <input className="input" name="phone" defaultValue={customer.phone} />
            </label>
            <label className="field">
              微信
              <input className="input" name="wechat" defaultValue={customer.wechat} />
            </label>
            <label className="field">
              Telegram
              <input className="input" name="telegram" defaultValue={customer.telegram} />
            </label>
          </div>
          <label className="field">
            内部备注
            <textarea className="input min-h-24" name="note" defaultValue={customer.note} />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
            <input name="isActive" type="checkbox" defaultChecked={customer.user.isActive} />
            允许客户登录
          </label>
          <button className="btn btn-primary w-fit" type="submit">
            保存客户
          </button>
        </form>

        <div className="grid gap-5">
          <div className="card p-5">
            <h2 className="text-lg font-black">创建服务套餐</h2>
            <form action={createServiceAction} className="mt-4 grid gap-4 md:grid-cols-2" encType="multipart/form-data">
              <input name="customerId" type="hidden" value={customer.id} />
              <label className="field">
                服务名称
                <input className="input" name="title" placeholder="日本低延迟专线" required />
              </label>
              <label className="field">
                套餐类型
                <input className="input" name="packageType" placeholder="直播专线 / 短视频矩阵 / AI" required />
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
                开始时间
                <input className="input" name="startAt" type="date" required />
              </label>
              <label className="field">
                到期时间
                <input className="input" name="expiresAt" type="date" required />
              </label>
              <label className="field md:col-span-2">
                订阅链接
                <input className="input" name="subscriptionUrl" placeholder="只展示给该客户" />
              </label>
              <label className="field">
                二维码图片
                <input className="input" name="qrCodeFile" type="file" accept="image/*" />
              </label>
              <label className="field">
                二维码链接
                <input className="input" name="qrCodeUrl" placeholder="也可以直接填图片 URL" />
              </label>
              <label className="field md:col-span-2">
                使用说明
                <textarea className="input min-h-28" name="instructions" placeholder="连接方式、注意事项、客服说明" />
              </label>
              <button className="btn btn-primary w-fit md:col-span-2" type="submit">
                创建套餐
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-black">服务套餐</h2>
        </div>
        <div className="grid gap-4 p-5">
          {customer.services.map((service) => (
            <form action={updateServiceAction} className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-4" key={service.id}>
              <input name="serviceId" type="hidden" value={service.id} />
              <input name="customerId" type="hidden" value={customer.id} />
              <label className="field">
                服务名称
                <input className="input" name="title" defaultValue={service.title} />
              </label>
              <label className="field">
                套餐类型
                <input className="input" name="packageType" defaultValue={service.packageType} />
              </label>
              <label className="field">
                目标地区
                <input className="input" name="targetRegion" defaultValue={service.targetRegion} />
              </label>
              <label className="field">
                设备数量
                <input className="input" name="deviceCount" type="number" min="1" defaultValue={service.deviceCount} />
              </label>
              <label className="field">
                开始时间
                <input className="input" name="startAt" type="date" defaultValue={dateOnly(service.startAt)} />
              </label>
              <label className="field">
                到期时间
                <input className="input" name="expiresAt" type="date" defaultValue={dateOnly(service.expiresAt)} />
              </label>
              <label className="field">
                状态
                <select className="input" name="status" defaultValue={service.status}>
                  {Object.values(ServiceStatus).map((status) => (
                    <option value={status} key={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                创建时间
                <span className="input flex items-center bg-slate-50">{displayDate(service.createdAt)}</span>
              </div>
              <label className="field lg:col-span-2">
                订阅链接
                <input className="input" name="subscriptionUrl" defaultValue={service.subscriptionUrl} />
              </label>
              <label className="field lg:col-span-2">
                二维码链接
                <input className="input" name="qrCodeUrl" defaultValue={service.qrCodeUrl} />
              </label>
              <label className="field lg:col-span-4">
                使用说明
                <textarea className="input min-h-24" name="instructions" defaultValue={service.instructions} />
              </label>
              <button className="btn btn-primary w-fit lg:col-span-4" type="submit">
                保存套餐
              </button>
            </form>
          ))}
          {!customer.services.length ? <p className="text-sm text-slate-500">还没有服务套餐</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
