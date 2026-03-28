import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RoomView from './pages/RoomView'
import PolicyEditor from './pages/PolicyEditor'
import RoundResults from './pages/RoundResults'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import { getUser } from './api'

function ProtectedRoute({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<ProtectedRoute><RoomView /></ProtectedRoute>} />
      <Route path="/room/:roomId/create-round" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/round/:roundId" element={<ProtectedRoute><PolicyEditor /></ProtectedRoute>} />
      <Route path="/round/:roundId/results" element={<ProtectedRoute><RoundResults /></ProtectedRoute>} />
      <Route path="/leaderboard/season/:roomId" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/leaderboard/:roundId" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
