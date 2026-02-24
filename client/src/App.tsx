import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LandingPage } from '@/pages/LandingPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { CoursePage } from '@/pages/CoursePage';
import { SessionPage } from '@/pages/SessionPage';
import { ArtifactPage } from '@/pages/ArtifactPage';
import { ExamPrepPage } from '@/pages/ExamPrepPage';

export default function App() {
  const init = useAuthStore(s => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/courses/:id" element={<CoursePage />} />
        <Route path="/courses/:id/exam-prep" element={<ExamPrepPage />} />
        <Route path="/sessions/:id" element={<SessionPage />} />
        <Route path="/artifacts/:id" element={<ArtifactPage />} />
      </Route>
    </Routes>
  );
}
