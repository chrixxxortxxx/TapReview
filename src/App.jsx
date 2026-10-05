import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { WorkspaceProvider } from './lib/workspace'
import { Spinner } from './components/ui'
import Layout from './components/Layout'
import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Register from './pages/public/Register'
import NotFound from './pages/public/NotFound'

// Dashboard pages are code-split so the public NFC landing page stays tiny and fast.
const Dashboard = lazy(() => import('./pages/app/Dashboard'))
const MapPage = lazy(() => import('./pages/app/MapPage'))
const Restaurants = lazy(() => import('./pages/app/Restaurants'))
const RestaurantDetail = lazy(() => import('./pages/app/RestaurantDetail'))
const Branches = lazy(() => import('./pages/app/Branches'))
const Cards = lazy(() => import('./pages/app/Cards'))
const CardDetail = lazy(() => import('./pages/app/CardDetail'))
const QRCodes = lazy(() => import('./pages/app/QRCodes'))
const Analytics = lazy(() => import('./pages/app/Analytics'))
const ActivityLogs = lazy(() => import('./pages/app/ActivityLogs'))
const Reports = lazy(() => import('./pages/app/Reports'))
const UsersPage = lazy(() => import('./pages/app/Users'))
const Settings = lazy(() => import('./pages/app/Settings'))
const GoogleReview = lazy(() => import('./pages/app/GoogleReview'))
const Profile = lazy(() => import('./pages/app/Profile'))
const Onboarding = lazy(() => import('./pages/app/Onboarding'))

function Home() {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <Spinner fill />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/admin' : '/app'} replace />
}

/** Route guard. Real enforcement happens server-side (RLS); this just keeps the UI consistent. */
function Protected({ admin }) {
  const { user, loading, isAdmin, memberships } = useAuth()
  if (loading) return <Spinner fill />
  if (!user) return <Navigate to="/login" replace />
  if (admin && !isAdmin) return <Navigate to="/app" replace />
  if (!admin && isAdmin) return <Navigate to="/admin" replace />
  if (!admin && memberships.length === 0)
    return (
      <Suspense fallback={<Spinner fill />}>
        <Onboarding />
      </Suspense>
    )
  return (
    <WorkspaceProvider key={user.id}>
      <Suspense fallback={<Spinner fill />}>
        <Layout />
      </Suspense>
    </WorkspaceProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/t/:token" element={<Landing />} />

      <Route path="/admin" element={<Protected admin />}>
        <Route index element={<Dashboard />} />
        <Route path="map" element={<MapPage />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        <Route path="branches" element={<Branches />} />
        <Route path="cards" element={<Cards />} />
        <Route path="cards/:id" element={<CardDetail />} />
        <Route path="qr" element={<QRCodes />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="logs" element={<ActivityLogs />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="/app" element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="branches" element={<Branches />} />
        <Route path="cards" element={<Cards />} />
        <Route path="cards/:id" element={<CardDetail />} />
        <Route path="qr" element={<QRCodes />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="review" element={<GoogleReview />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
