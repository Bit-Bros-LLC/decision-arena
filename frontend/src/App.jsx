import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RoomView from './pages/RoomView'
import PolicyEditor from './pages/PolicyEditor'
import RoundResults from './pages/RoundResults'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import SeasonCreator from './pages/SeasonCreator'
import SeasonView from './pages/SeasonView'
import SeasonSprintBuilder from './pages/SeasonSprintBuilder'
import SoloSeasonsPage from './pages/SoloSeasonsPage'
import AccountSettings from './pages/AccountSettings'
import LearnHub from './pages/LearnHub'
import LessonPage from './pages/LessonPage'
import LandingPage from './pages/LandingPage'
import NavBar from './components/NavBar'
import BreadcrumbBar from './components/BreadcrumbBar'
import { BreadcrumbLabelsProvider } from './context/BreadcrumbLabelsContext'
import ConsentBanner from './components/ConsentBanner'
import AnalyticsTracker from './components/AnalyticsTracker'
import { getUser } from './api'
import { getAnalyticsConsent, initAnalytics, setAnalyticsConsent } from './lib/analytics'

function ProtectedLayout() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <BreadcrumbLabelsProvider>
      <NavBar />
      <BreadcrumbBar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </BreadcrumbLabelsProvider>
  );
}

export default function App() {
  const [consent, setConsent] = useState(() => getAnalyticsConsent())

  useEffect(() => {
    if (consent === 'granted') initAnalytics()
  }, [consent])

  const showConsentBanner = consent === 'unknown'

  const handleAcceptAnalytics = () => {
    setAnalyticsConsent('granted')
    setConsent('granted')
  }

  const handleDeclineAnalytics = () => {
    setAnalyticsConsent('denied')
    setConsent('denied')
  }

  return (
    <>
      <AnalyticsTracker consent={consent} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/room/:roomId" element={<RoomView />} />
          <Route path="/room/:roomId/create-round" element={<Admin />} />
          <Route path="/room/:roomId/edit-round/:roundId" element={<Admin />} />
          <Route path="/room/:roomId/create-season" element={<SeasonCreator />} />
          <Route path="/room/:roomId/season/:seasonId" element={<SeasonView />} />
          <Route path="/room/:roomId/season-sprint/new" element={<SeasonSprintBuilder />} />
          <Route path="/season-sprint/new" element={<SeasonSprintBuilder />} />
          <Route path="/season-sprint/:seasonId" element={<SeasonView />} />
          <Route path="/solo-seasons" element={<SoloSeasonsPage />} />
          <Route path="/round/:roundId" element={<PolicyEditor />} />
          <Route path="/round/:roundId/results" element={<RoundResults />} />
          <Route
            path="/leaderboard/room/:roomId/template/:templateId/cohort"
            element={<Leaderboard />}
          />
          <Route path="/leaderboard/season/:seasonId" element={<Leaderboard />} />
          <Route path="/leaderboard/:roundId" element={<Leaderboard />} />
          <Route path="/account" element={<AccountSettings />} />
          <Route path="/learn" element={<LearnHub />} />
          <Route path="/learn/:slug" element={<LessonPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showConsentBanner && (
        <ConsentBanner onAccept={handleAcceptAnalytics} onDecline={handleDeclineAnalytics} />
      )}
    </>
  );
}
