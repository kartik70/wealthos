"use client";

import {
  BriefcaseBusiness,
  BotMessageSquare,
  CloudUpload,
  Gauge,
  Landmark,
  Lightbulb,
  LogOut,
  Settings,
  Target,
  Timeline,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";

import { createSupabaseBrowserClient } from "@/lib/db/supabase";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/timeline", label: "Timeline", icon: Timeline },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/advisor", label: "Advisor", icon: BotMessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  onImportPortfolio: () => void;
  onNavigate?: () => void;
}

function getInitials(email: string | undefined): string {
  if (email === undefined || email === "") {
    return "?";
  }

  const localPart = email.split("@")[0] ?? "";
  const parts = localPart.split(/[._-]/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return localPart.slice(0, 2).toUpperCase();
}

export function Sidebar({ onImportPortfolio, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    void supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  async function signOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName =
    userEmail === null ? "Account" : (userEmail.split("@")[0] ?? "Account");
  const initials = getInitials(userEmail ?? undefined);

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col"
      style={{
        background: "#0a0f1e",
        borderRight: "1px solid #1e2d40",
        color: "#f0f4f8",
      }}
    >
      <div
        className="flex h-16 items-center px-5"
        style={{ borderBottom: "1px solid #1e2d40" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="grid size-8 place-items-center rounded-lg p-1.5"
            style={{ background: "rgba(30, 58, 138, 0.3)", color: "#3b82f6" }}
          >
            <Landmark className="size-4" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p
              className="text-base text-white"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              WealthOS
            </p>
            <p
              className="text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "#4a5568" }}
            >
              Portfolio Intelligence
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 py-3">
        <button
          type="button"
          onClick={onImportPortfolio}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#2563eb";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#3b82f6";
          }}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white transition-all duration-150"
          style={{ background: "#3b82f6" }}
        >
          <CloudUpload className="size-4" aria-hidden="true" />
          Import Portfolio
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150",
              )}
              style={
                isActive
                  ? {
                      background: "#1a2235",
                      color: "#ffffff",
                      borderLeft: "2px solid #3b82f6",
                      paddingLeft: "calc(0.75rem - 2px)",
                    }
                  : { color: "#8899aa" }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.background = "#111827";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#8899aa";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className="space-y-2 p-3"
        style={{ borderTop: "1px solid #1e2d40" }}
      >
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div
            className="grid size-9 shrink-0 place-items-center rounded-full font-mono text-xs"
            style={{
              background: "#1a2235",
              color: "#3b82f6",
              fontWeight: 500,
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm text-white"
              style={{ fontWeight: 500 }}
            >
              {displayName}
            </p>
            <p
              className="truncate text-xs"
              style={{ color: "#4a5568" }}
            >
              {userEmail ?? "Signed in"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={isSigningOut}
            aria-label={isSigningOut ? "Signing out" : "Sign out"}
            title="Sign out"
            className="grid size-8 shrink-0 place-items-center rounded-md transition-colors disabled:opacity-50"
            style={{ color: "#8899aa" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#f43f5e";
              e.currentTarget.style.background = "#111827";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#8899aa";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
