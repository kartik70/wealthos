"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  Gauge,
  Lightbulb,
  Settings,
  Timeline,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

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
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-5">
        <div className="flex items-center gap-2 font-heading text-base font-semibold">
          <BarChart3 className="size-5" aria-hidden="true" />
          <span>WealthOS</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2.5 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive &&
                  "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
