import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <Sidebar />

      <div className="ml-[250px] min-h-screen">
        <Header />
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
