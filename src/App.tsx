import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Overview from "@/pages/Overview";
import Repositories from "@/pages/Repositories";
import DependencyGraphPage from "@/pages/DependencyGraphPage";
import ImpactAnalysis from "@/pages/ImpactAnalysis";
import Settings from "@/pages/Settings";
import ChangeAnalysis from "@/pages/ChangeAnalysis";

function App() {
  return (
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
  );
}

export default App;
