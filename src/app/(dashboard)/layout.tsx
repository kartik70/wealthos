"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ImportPortfolioModal } from "@/components/layout/ImportPortfolioModal";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    function openImportModal() {
      setIsImportModalOpen(true);
    }

    window.addEventListener("wealthos:open-import", openImportModal);
    return () => {
      window.removeEventListener("wealthos:open-import", openImportModal);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <aside className="hidden h-screen shrink-0 lg:block">
        <Sidebar onImportPortfolio={() => setIsImportModalOpen(true)} />
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          isSidebarOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-background/70 transition-opacity",
            isSidebarOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close navigation"
        />
        <div
          className={cn(
            "relative h-full w-64 border-r bg-sidebar transition-transform",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar
            onImportPortfolio={() => {
              setIsImportModalOpen(true);
              setIsSidebarOpen(false);
            }}
            onNavigate={() => setIsSidebarOpen(false)}
          />
        </div>
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen((current) => !current)}
            aria-label="Open navigation"
          >
            {isSidebarOpen ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <Menu className="size-4" aria-hidden="true" />
            )}
          </Button>
          <p className="font-heading text-base font-semibold tracking-tight">WealthOS</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
          >
            Import
          </Button>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-5">
          {children}
        </div>
      </main>

      <ImportPortfolioModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
      />
    </div>
  );
}
