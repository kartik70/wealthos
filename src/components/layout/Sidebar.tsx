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

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/db/supabase";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Gauge },
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
        background: "var(--background)",
        borderRight: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="flex h-16 items-center px-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="grid size-8 place-items-center rounded-md"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            <Landmark className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p
              className="text-base font-semibold tracking-tight"
              style={{ color: "var(--text-primary)", fontWeight: 600 }}
            >
              WealthOS
            </p>
            <p
              className="text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--text-tertiary)" }}
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
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          <CloudUpload className="size-4" aria-hidden="true" />
          Import Portfolio
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex h-9 items-center gap-2.5 rounded-md pl-3 pr-3 text-sm transition-colors",
              )}
              style={
                isActive
                  ? {
                      background: "var(--accent-muted)",
                      color: "var(--text-primary)",
                      borderLeft: "2px solid var(--accent)",
                      paddingLeft: "calc(0.75rem - 2px)",
                    }
                  : { color: "var(--text-secondary)" }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--text-secondary)";
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
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="grid size-8 place-items-center rounded-full text-xs font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {displayName}
            </p>
            <p
              className="truncate text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {userEmail ?? "Signed in"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => void signOut()}
          disabled={isSigningOut}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </aside>
  );
}
