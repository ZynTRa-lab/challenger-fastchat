import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import MainLayout from './components/MainLayout';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-discord-medium">
        <div className="animate-spin w-12 h-12 border-4 border-discord-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <Routes>
      <Route path="/channels/*" element={<MainLayout />} />
      <Route path="*" element={<Navigate to="/channels/@me" replace />} />
    </Routes>
  );
}
