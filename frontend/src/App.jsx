import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RoomView from './pages/RoomView'
import PolicyEditor from './pages/PolicyEditor'
import RoundResults from './pages/RoundResults'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import AccountSettings from './pages/AccountSettings'
import LearnHub from './pages/LearnHub'
import LessonPage from './pages/LessonPage'
import LandingPage from './pages/LandingPage'
import NavBar from './components/NavBar'
import { getUser } from './api'

function ProtectedLayout() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/room/:roomId" element={<RoomView />} />
        <Route path="/room/:roomId/create-round" element={<Admin />} />
        <Route path="/room/:roomId/edit-round/:roundId" element={<Admin />} />
        <Route path="/round/:roundId" element={<PolicyEditor />} />
        <Route path="/round/:roundId/results" element={<RoundResults />} />
        <Route path="/leaderboard/season/:roomId" element={<Leaderboard />} />
        <Route path="/leaderboard/:roundId" element={<Leaderboard />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/learn" element={<LearnHub />} />
        <Route path="/learn/:slug" element={<LessonPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
