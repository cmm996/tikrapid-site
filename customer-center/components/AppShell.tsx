import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
};

export function AppShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase text-blue-600">TikRapid</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {nav.map((item) => (
              <Link className="btn" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <Link className="btn" href="/logout">
              退出
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-6">{children}</main>
    </div>
  );
}
