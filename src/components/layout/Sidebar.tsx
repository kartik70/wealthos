"use client";

import {
  BriefcaseBusiness,
  BotMessageSquare,
  CloudUpload,
  Gauge,
  Landmark,
  Lightbulb,
  Settings,
  Target,
  Timeline,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import { Button } from "@/components/ui/button";
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
  onImportCsv: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ onImportCsv, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b px-5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-md bg-foreground text-background">
            <Landmark className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="font-heading text-base font-semibold tracking-tight">WealthOS</p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Portfolio Intelligence
            </p>
          </div>
        </div>
      </div>

      <div className="px-2.5 py-3">
        <Button className="w-full justify-start" onClick={onImportCsv}>
          <CloudUpload className="size-4" aria-hidden="true" />
          Import CSV
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2.5 py-1">
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
                "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-2.5 py-2">
          <div className="grid size-8 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
            RD
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Redeye</p>
            <p className="truncate text-xs text-muted-foreground">Investor</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
