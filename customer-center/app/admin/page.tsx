import Link from "next/link";
import { TicketStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";
import { displayDate, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [customerCount, activeServiceCount, openTicketCount, complianceCount, customers, tickets] = await Promise.all([
    prisma.customer.count(),
    prisma.serviceOrder.count({ where: { status: "ACTIVE" } }),
    prisma.ticket.count({ where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER] } } }),
    prisma.complianceConfirmation.count(),
    prisma.customer.findMany({
      include: { user: true, services: { orderBy: { expiresAt: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.ticket.findMany({
      include: { customer: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <AppShell
      title="管理员后台"
      subtitle="客户、套餐、工单和合规确认统一管理"
      nav={[
        { href: "/admin/customers/new", label: "创建客户" },
        { href: "/admin/tickets", label: "工单" },
        { href: "/admin/compliance", label: "合规记录" },
      ]}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="客户数" value={customerCount} />
        <Stat label="服务中套餐" value={activeServiceCount} />
        <Stat label="待处理工单" value={openTicketCount} />
        <Stat label="合规确认" value={complianceCount} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <h2 className="text-lg font-black">最近客户</h2>
            <Link className="btn btn-primary" href="/admin/customers/new">
              新建
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {customers.map((customer) => (
              <Link className="block p-5 hover:bg-slate-50" href={`/admin/customers/${customer.id}`} key={customer.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{customer.user.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{customer.user.email}</p>
                  </div>
                  <span className="badge">{customer.services[0] ? displayDate(customer.services[0].expiresAt) : "未建套餐"}</span>
                </div>
              </Link>
            ))}
            {!customers.length ? <p className="p-5 text-sm text-slate-500">还没有客户</p> : null}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <h2 className="text-lg font-black">最近工单</h2>
            <Link className="btn" href="/admin/tickets">
              查看全部
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <div className="p-5" key={ticket.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-slate-950">{ticket.issueType}</p>
                  <span className="badge">{statusLabel(ticket.status)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {ticket.customer.user.name} / {ticket.targetRegion} / {displayDate(ticket.createdAt)}
                </p>
              </div>
            ))}
            {!tickets.length ? <p className="p-5 text-sm text-slate-500">还没有工单</p> : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}
