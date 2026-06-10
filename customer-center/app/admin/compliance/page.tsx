import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCompliancePage() {
  await requireAdmin();
  const records = await prisma.complianceConfirmation.findMany({
    include: { customer: { include: { user: true } } },
    orderBy: { acceptedAt: "desc" },
    take: 200,
  });

  return (
    <AppShell title="合规确认记录" subtitle="客户首次登录必须确认服务合规使用告知" nav={[{ href: "/admin", label: "后台首页" }]}>
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">客户</th>
                <th className="p-4">版本</th>
                <th className="p-4">确认时间</th>
                <th className="p-4">IP</th>
                <th className="p-4">User Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="p-4">
                    <Link className="font-black text-blue-600" href={`/admin/customers/${record.customer.id}`}>
                      {record.customer.user.name}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">{record.customer.user.email}</p>
                  </td>
                  <td className="p-4">{record.version}</td>
                  <td className="p-4">{displayDate(record.acceptedAt)}</td>
                  <td className="p-4">{record.ipAddress || "-"}</td>
                  <td className="max-w-md p-4 text-xs text-slate-500">{record.userAgent || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!records.length ? <p className="p-5 text-sm text-slate-500">还没有合规确认记录</p> : null}
      </section>
    </AppShell>
  );
}
