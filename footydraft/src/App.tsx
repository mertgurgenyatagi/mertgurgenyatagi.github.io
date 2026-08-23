import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { Draft } from './routes/Draft'
import { Home } from './routes/Home'
import { MultiLobby } from './routes/MultiLobby'
import { SoloLobby } from './routes/SoloLobby'

/**
 * `HashRouter` specifically: GitHub Pages serves static files with no rewrite
 * rules, so a deep link has to live in the hash or it 404s on refresh.
 *
 * Both lobbies keep their identity in the path rather than in state, so
 * /#/solo/free-pick and /#/lobby/KX7QD are real, shareable addresses — the
 * second one is the invite link.
 */
export function App() {
  return (
    <HashRouter>
      <AppShell>
        {/* Inside the shell, so a failed screen keeps the frame, the backdrop
            and the palette around it rather than dropping to a bare page. */}
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/solo" element={<SoloLobby />} />
            <Route path="/solo/:formatId" element={<SoloLobby />} />
            <Route path="/lobby/:code" element={<MultiLobby />} />
            <Route path="/draft/:formatId" element={<Draft />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </ErrorBoundary>
      </AppShell>
    </HashRouter>
  )
}
