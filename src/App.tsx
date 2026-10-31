import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import Overview from "@/pages/Overview";
import Repositories from "@/pages/Repositories";
import DependencyGraphPage from "@/pages/DependencyGraphPage";
import ImpactAnalysis from "@/pages/ImpactAnalysis";
import Settings from "@/pages/Settings";
import ChangeAnalysis from "@/pages/ChangeAnalysis";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="repositories" element={<Repositories />} />
            <Route path="graph" element={<DependencyGraphPage />} />
            <Route path="changes" element={<ChangeAnalysis />} />
            <Route path="impact" element={<ImpactAnalysis />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
