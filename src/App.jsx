import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ExplainProvider } from './context/ExplainContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Journey from './pages/Journey';
import TimelinePage from './pages/TimelinePage';
import Chat from './pages/Chat';
import Eligibility from './pages/Eligibility';
import Simulation from './pages/Simulation';
import LearnFast from './pages/LearnFast';

export default function App() {
  return (
    <ExplainProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </ExplainProvider>
  );
}
