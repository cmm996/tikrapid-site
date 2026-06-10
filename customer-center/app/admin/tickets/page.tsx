import Link from "next/link";
import { TicketStatus } from "@prisma/client";
import { updateTicketStatusAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { displayDate, statusLabel } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  await requireAdmin();
  const tickets = await prisma.ticket.findMany({
    include: {
      customer: { include: { user: true } },
      serviceOrder: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell title="工单管理" subtitle="查看客户问题并更新处理状态" nav={[{ href: "/admin", label: "后台首页" }]}>
      <section className="grid gap-4">
        {tickets.map((ticket) => (
          <article className="card grid gap-4 p-5" key={ticket.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">{statusLabel(ticket.status)}</span>
                  <span className="badge">{ticket.issueType}</span>
                  <span className="badge">{ticket.useCase}</span>
                </div>
                <h2 className="mt-3 text-xl font-black text-slate-950">{ticket.customer.user.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {ticket.targetRegion} / {ticket.deviceCount} 台设备 / 发生于 {displayDate(ticket.occurredAt)}
                </p>
                {ticket.serviceOrder ? (
                  <p className="mt-1 text-sm text-slate-500">关联套餐：{ticket.serviceOrder.title}</p>
                ) : null}
              </div>
              <Link className="btn" href={`/admin/customers/${ticket.customer.id}`}>
                查看客户
              </Link>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              {ticket.description}
              {ticket.imageUrl ? (
                <p className="mt-3">
                  <a className="font-bold text-blue-600" href={ticket.imageUrl} target="_blank" rel="noreferrer">
                    查看上传图片
                  </a>
                </p>
              ) : null}
            </div>

            <form action={updateTicketStatusAction} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
              <input name="ticketId" type="hidden" value={ticket.id} />
              <label className="field">
                状态
                <select className="input" name="status" defaultValue={ticket.status}>
                  {Object.values(TicketStatus).map((status) => (
                    <option value={status} key={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                处理备注
                <input className="input" name="adminNote" defaultValue={ticket.adminNote} placeholder="内部处理记录" />
              </label>
              <button className="btn btn-primary self-end" type="submit">
                更新
              </button>
            </form>
          </article>
        ))}
        {!tickets.length ? <div className="card p-5 text-sm text-slate-500">还没有工单</div> : null}
      </section>
    </AppShell>
  );
}
