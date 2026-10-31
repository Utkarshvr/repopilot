import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <Sidebar />

      <div className="ml-[250px] min-h-screen">
        <Header />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
