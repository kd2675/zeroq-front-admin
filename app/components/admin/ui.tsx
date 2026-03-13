"use client";

import Link from "next/link";
import { ReactNode, useEffect } from "react";
import type { AuthUser } from "@/app/types/auth";

type IconName =
  | "dashboard"
  | "areas"
  | "sensors"
  | "gateways"
  | "analytics"
  | "settings"
  | "logs"
  | "alert"
  | "arrow"
  | "logout"
  | "refresh"
  | "search"
  | "spark"
  | "help"
  | "more";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  group: "management" | "system";
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: "dashboard", group: "management" },
  { key: "areas", label: "Area Management", href: "/areas", icon: "areas", group: "management" },
  { key: "sensors", label: "Sensor List", href: "/sensors", icon: "sensors", group: "management" },
  { key: "gateways", label: "Gateway List", href: "/gateways", icon: "gateways", group: "management" },
  { key: "analytics", label: "Data Analytics", href: "/analytics", icon: "analytics", group: "management" },
  { key: "settings", label: "Settings", href: "/settings", icon: "settings", group: "system" },
  { key: "logs", label: "Logs", href: "/logs", icon: "logs", group: "system" },
];

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const base = {
    className: cn("size-4", className),
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...base}>
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </svg>
      );
    case "areas":
      return (
        <svg {...base}>
          <path d="M4 19V8l8-4 8 4v11" />
          <path d="M4 19h16" />
          <path d="M9 19v-5h6v5" />
        </svg>
      );
    case "sensors":
      return (
        <svg {...base}>
          <path d="M12 5v6" />
          <path d="M8 8a5.7 5.7 0 0 0 0 8" />
          <path d="M16 8a5.7 5.7 0 0 1 0 8" />
          <path d="M5 5a9.8 9.8 0 0 0 0 14" />
          <path d="M19 5a9.8 9.8 0 0 1 0 14" />
          <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "gateways":
      return (
        <svg {...base}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M8 10h8M8 14h3" />
          <path d="M7 20h10" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...base}>
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-7" />
        </svg>
      );
    case "settings":
      return (
        <svg {...base}>
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5z" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z" />
        </svg>
      );
    case "logs":
      return (
        <svg {...base}>
          <path d="M8 7h10M8 12h10M8 17h10" />
          <path d="M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
      );
    case "alert":
      return (
        <svg {...base}>
          <path d="M12 3l9 16H3z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...base}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case "logout":
      return (
        <svg {...base}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...base}>
          <path d="M20 11a8 8 0 1 0 2 5.3" />
          <path d="M20 4v7h-7" />
        </svg>
      );
    case "search":
      return (
        <svg {...base}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4-4" />
        </svg>
      );
    case "spark":
      return (
        <svg {...base}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
        </svg>
      );
    case "help":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.4a2.6 2.6 0 1 1 4.1 2.1c-.9.6-1.4 1.1-1.4 2.1" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "more":
      return (
        <svg {...base}>
          <path d="M12 5h.01M12 12h.01M12 19h.01" />
        </svg>
      );
  }
}

function SidebarNav({
  title,
  items,
  activeKey,
}: {
  title: string;
  items: NavItem[];
  activeKey: string;
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sky-500/12 text-sky-600 shadow-[inset_4px_0_0_0_#2b8cee] dark:bg-sky-400/12 dark:text-sky-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white",
              )}
            >
              <Icon name={item.icon} className="size-[18px]" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4fb_0%,#f6f7f8_55%,#e8eef5_100%)] px-6 py-10 dark:bg-[linear-gradient(180deg,#101922_0%,#0f1721_55%,#0b1118_100%)]">
      <div className="mx-auto flex max-w-5xl items-center justify-center rounded-[28px] border border-slate-200/80 bg-white/90 px-8 py-24 text-sm text-slate-500 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
        관리자 세션과 공간 데이터를 확인하는 중입니다.
      </div>
    </div>
  );
}

export function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Panel className="grid min-h-56 place-items-center text-center">
      <div className="max-w-md space-y-2">
        <p className="text-lg font-bold text-slate-900 dark:text-white">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </Panel>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-[0_18px_52px_rgba(2,8,23,0.34)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "cyan",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "cyan" | "orange" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "orange"
      ? "bg-orange-500/10 text-orange-500 dark:bg-orange-500/12 dark:text-orange-300"
      : tone === "emerald"
        ? "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/12 dark:text-emerald-300"
        : tone === "rose"
          ? "bg-rose-500/10 text-rose-500 dark:bg-rose-500/12 dark:text-rose-300"
          : "bg-sky-500/10 text-sky-600 dark:bg-sky-500/12 dark:text-sky-300";

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/65">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={cn("rounded-2xl p-2.5", toneClass)}>
          <div className="size-5 rounded-md bg-current/15" />
        </div>
        <div className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Live
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "info" | "warning" | "critical" | "success" | "neutral";
  children: ReactNode;
}) {
  const toneClass =
    tone === "critical"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300"
      : tone === "warning"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300"
        : tone === "success"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300"
          : tone === "info"
            ? "bg-sky-100 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

export function MiniBars({ points }: { points: Array<{ label: string; value: number }> }) {
  return (
    <div>
      <div className="flex h-44 items-end gap-2">
        {points.map((point, index) => (
          <div key={`bar-${point.label}-${index}`} className="flex flex-1 flex-col justify-end">
            <div
              className="rounded-t-lg bg-gradient-to-t from-sky-500 via-sky-400 to-sky-300 shadow-[0_10px_30px_rgba(43,140,238,0.28)]"
              style={{ height: `${Math.max(point.value, 8)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {points.map((point, index) => (
          <span key={`label-${point.label}-${index}`}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

export function ModalFrame({
  open,
  title,
  description,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fdfefe_0%,#f4f8fc_100%)] shadow-[0_28px_90px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,#111926_0%,#0b1320_100%)] dark:shadow-[0_28px_90px_rgba(2,8,23,0.62)]">
        <div className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-500 dark:text-sky-300">
                Zone Provisioning
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {title}
              </h2>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              닫기
            </button>
          </div>
        </div>
        <div className="px-6 py-6">{children}</div>
        {footer ? (
          <div className="border-t border-slate-200/80 bg-white/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/40">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminShell({
  activeKey,
  title,
  subtitle,
  user,
  toolbar,
  onLogout,
  children,
}: {
  activeKey: string;
  title: string;
  subtitle: string;
  user: AuthUser | null;
  toolbar?: ReactNode;
  onLogout: () => void;
  children: ReactNode;
}) {
  const managementItems = NAV_ITEMS.filter((item) => item.group === "management");
  const systemItems = NAV_ITEMS.filter((item) => item.group === "system");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#edf3fb_0%,#f6f7f8_46%,#eef3f8_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#101922_0%,#111b26_55%,#0d141c_100%)] dark:text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50/95 backdrop-blur md:flex dark:border-slate-800 dark:bg-slate-950/70">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-[#2b8cee] text-white shadow-[0_18px_34px_rgba(43,140,238,0.3)]">
                <Icon name="spark" className="size-5" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  ZeroQ Admin
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Facility operations console
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-8 px-4 py-2">
            <SidebarNav title="Management" items={managementItems} activeKey={activeKey} />
            <SidebarNav title="System" items={systemItems} activeKey={activeKey} />
          </div>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-sky-500/15 text-sm font-bold text-sky-600 dark:text-sky-300">
                  {(user?.username ?? "AD").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {user?.username ?? "Admin User"}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {user?.role ?? "MANAGER"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="logout"
                >
                  <Icon name="logout" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-950/55">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                  ZeroQ Facility Management
                </p>
                <h1 className="mt-2 truncate text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="notifications"
                >
                  <Icon name="alert" />
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="help"
                >
                  <Icon name="help" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2 overflow-x-auto md:hidden">
                {NAV_ITEMS.map((item) => {
                  const active = item.key === activeKey;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cn(
                        "whitespace-nowrap rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em]",
                        active
                          ? "border-sky-200 bg-sky-500/10 text-sky-700 dark:border-sky-500/30 dark:bg-sky-400/12 dark:text-sky-200"
                          : "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              {toolbar ? <div className="flex flex-wrap gap-3">{toolbar}</div> : null}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
