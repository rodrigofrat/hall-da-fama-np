import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './app/auth';
import { DataProvider } from './app/data';
import { Shell } from './app/Shell';
import { AccountPage } from './pages/Account';
import { AdminPage } from './pages/Admin';
import { CouponsPage } from './pages/Coupons';
import { DrawsPage } from './pages/Draws';
import { GiftsPage } from './pages/Gifts';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { PipPage } from './pages/Pip';
import { RulesPage } from './pages/Rules';
import { VideoPage } from './pages/Videos';
import { Loading } from './ui/components';

const TITLES: Record<string, string> = {
  '/': 'Início', '/cupons': 'Meus cupons', '/cupons/ranking': 'Ranking', '/cupons/comparar': 'Comparar',
  '/sorteios': 'Sorteios', '/conta': 'Minha conta', '/conta/pip': 'Participação e PIP',
  '/conta/presentes': 'Meus presentes', '/conta/regulamento': 'Regulamento', '/admin': 'Administração', '/videos/painel': 'Como usar o painel', '/videos/hall-da-fama': 'O que é o Hall da Fama',
};

function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${TITLES[pathname] ?? 'Hall da Fama'} · Hall da Fama NP`;
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Gate() {
  const { ready, signedIn } = useAuth();
  if (!ready) return <div className="main"><Loading /></div>;
  if (!signedIn) return <LoginPage />;
  return (
    <DataProvider>
      <Shell>
        <RouteEffects />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cupons" element={<CouponsPage tab="meus" />} />
          <Route path="/cupons/ranking" element={<CouponsPage tab="ranking" />} />
          <Route path="/cupons/comparar" element={<CouponsPage tab="comparar" />} />
          <Route path="/sorteios" element={<DrawsPage />} />
          <Route path="/conta" element={<AccountPage />} />
          <Route path="/conta/pip" element={<PipPage />} />
          <Route path="/conta/presentes" element={<GiftsPage />} />
          <Route path="/conta/regulamento" element={<RulesPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/videos/:id" element={<VideoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </DataProvider>
  );
}

export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </HashRouter>
  );
}
