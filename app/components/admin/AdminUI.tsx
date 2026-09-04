"use client";

import Link from "next/link";
import { ReactNode, useEffect, useId, useRef } from "react";
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
  { key: "dashboard", label: "운영 현황", href: "/", icon: "dashboard", group: "management" },
  { key: "areas", label: "공간 관리", href: "/areas", icon: "areas", group: "management" },
  { key: "sensors", label: "센서", href: "/sensors", icon: "sensors", group: "management" },
  { key: "gateways", label: "게이트웨이", href: "/gateways", icon: "gateways", group: "management" },
  { key: "analytics", label: "사용 분석", href: "/analytics", icon: "analytics", group: "management" },
  { key: "settings", label: "운영 설정", href: "/settings", icon: "settings", group: "system" },
  { key: "logs", label: "이벤트 로그", href: "/logs", icon: "logs", group: "system" },
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
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "bg-blue-50 font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"
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
    <div className="grid min-h-dvh place-items-center bg-[var(--background)] px-6" aria-live="polite">
      <div className="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
        <span className="mx-auto mb-4 block size-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" aria-hidden="true" />
        관리자 세션과 운영 데이터를 확인하고 있습니다.
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
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70",
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
      ? "border-l-amber-500"
      : tone === "emerald"
        ? "border-l-emerald-500"
        : tone === "rose"
          ? "border-l-rose-500"
          : "border-l-blue-500";

  return (
    <div className={cn("rounded-xl border border-l-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/65", toneClass)}>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-3 text-3xl font-black tabular-nums tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p>
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
      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300"
        : tone === "success"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300"
          : tone === "info"
            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/12 dark:text-blue-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  const dotClass =
    tone === "critical"
      ? "bg-rose-500"
      : tone === "warning"
        ? "bg-amber-500"
        : tone === "success"
          ? "bg-emerald-500"
          : tone === "info"
            ? "bg-blue-500"
            : "bg-slate-400";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        toneClass,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClass)} aria-hidden="true" />
      {children}
    </span>
  );
}

export function MiniBars({ points }: { points: Array<{ label: string; value: number }> }) {
  if (points.length === 0) {
    return (
      <div className="grid h-44 place-items-center border-y border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        이 기간에 표시할 관측 데이터가 없습니다.
      </div>
    );
  }

  const labelInterval = Math.max(1, Math.ceil(points.length / 6));
  const accessibleSummary = points
    .map((point) => `${point.label} ${Math.min(Math.max(point.value, 0), 100).toFixed(1)}%`)
    .join(", ");

  return (
    <div role="img" aria-label={`시간대별 사용률 막대그래프: ${accessibleSummary}`}>
      <div className="flex h-44 items-end gap-2">
        {points.map((point, index) => {
          const value = Math.min(Math.max(point.value, 0), 100);
          return (
            <div key={`bar-${point.label}-${index}`} className="flex h-full flex-1 flex-col justify-end" title={`${point.label} ${value.toFixed(1)}%`}>
              <div
                className="rounded-t bg-blue-500 transition-[height] duration-200 dark:bg-blue-400"
                style={{ height: `${value}%`, minHeight: value > 0 ? "2px" : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="mt-3 grid text-[10px] font-semibold text-slate-500 dark:text-slate-400"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point, index) => (
          <span key={`label-${point.label}-${index}`} className="text-center">
            {index % labelInterval === 0 || index === points.length - 1 ? point.label : ""}
          </span>
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const focusableSelector = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]";
    const initialControl = dialog?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")
      ?? dialog?.querySelector<HTMLElement>(focusableSelector);
    initialControl?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) {
        return;
      }

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-md)] dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-300">
                운영 설정
              </p>
              <h2 id={titleId} className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={`${title} 창 닫기`}
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
    <div className="min-h-dvh bg-[var(--background)] text-slate-900 dark:text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex dark:border-slate-800 dark:bg-slate-950">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-base font-black text-white shadow-sm">
                Q
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  ZeroQ 운영
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  공간·센서 관리 콘솔
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-8 px-4 py-2">
            <SidebarNav title="운영" items={managementItems} activeKey={activeKey} />
            <SidebarNav title="시스템" items={systemItems} activeKey={activeKey} />
          </div>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-blue-500/15 text-sm font-bold text-blue-600 dark:text-blue-300">
                  {(user?.username ?? "AD").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {user?.username ?? "관리자"}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {user?.role ?? "MANAGER"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="grid size-10 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="로그아웃"
                  title="로그아웃"
                >
                  <Icon name="logout" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-950/90">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-300">
                  ZeroQ 공간 운영
                </p>
                <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                  {title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
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
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "min-h-10 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold",
                        active
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-400/10 dark:text-blue-200"
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
            <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
