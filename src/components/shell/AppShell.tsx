"use client";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SidebarProvider, useSidebar } from "./SidebarContext";

export function AppShell({ crumb, children }: { crumb: string; children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ShellInner crumb={crumb}>{children}</ShellInner>
    </SidebarProvider>
  );
}

function ShellInner({ crumb, children }: { crumb: string; children: React.ReactNode }) {
  const { open, setOpen } = useSidebar();
  return (
    <div className="lg:grid lg:grid-cols-[248px_1fr] xl:grid-cols-[248px_1fr] min-h-screen relative">
      {/* Desktop sidebar — sticky+h-screen on the wrapper so it stays pinned
          regardless of how tall the grid track gets (long pages scrolled the
          inner aside off-screen otherwise). self-start prevents the grid from
          stretching the wrapper past 100vh. */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:self-start h-screen">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-black/50"
        />
        <div
          className={`absolute top-0 left-0 bottom-0 w-[248px] transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="flex flex-col min-w-0 min-h-screen">
        <Topbar crumb={crumb} />
        <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
