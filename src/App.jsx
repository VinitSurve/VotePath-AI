import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ExplainProvider } from './context/ExplainContext';
import Layout from './components/Layout';
import PageWrapper from './components/PageWrapper';
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
              <Route index element={<PageWrapper><Home /></PageWrapper>} />
              <Route path="journey" element={<PageWrapper><Journey /></PageWrapper>} />
              <Route path="timeline" element={<PageWrapper><TimelinePage /></PageWrapper>} />
              <Route path="chat" element={<PageWrapper><Chat /></PageWrapper>} />
              <Route path="eligibility" element={<PageWrapper><Eligibility /></PageWrapper>} />
              <Route path="simulation" element={<PageWrapper><Simulation /></PageWrapper>} />
              <Route path="learn-fast" element={<PageWrapper><LearnFast /></PageWrapper>} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ExplainProvider>
  );
}
