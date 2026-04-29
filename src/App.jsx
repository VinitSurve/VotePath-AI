import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ExplainProvider } from './context/ExplainContext';
import Layout from './components/Layout';
import Home from './pages/Home';

// Lazy loading pages for performance optimization
const Journey = React.lazy(() => import('./pages/Journey'));
const TimelinePage = React.lazy(() => import('./pages/TimelinePage'));
const Chat = React.lazy(() => import('./pages/Chat'));
const Eligibility = React.lazy(() => import('./pages/Eligibility'));
const Simulation = React.lazy(() => import('./pages/Simulation'));
const LearnFast = React.lazy(() => import('./pages/LearnFast'));

export default function App() {
  return (
    <ExplainProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium animate-pulse">Loading VotePath AI...</p>
            </div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="journey" element={<Journey />} />
              <Route path="timeline" element={<TimelinePage />} />
              <Route path="chat" element={<Chat />} />
              <Route path="eligibility" element={<Eligibility />} />
              <Route path="simulation" element={<Simulation />} />
              <Route path="learn-fast" element={<LearnFast />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ExplainProvider>
  );
}
