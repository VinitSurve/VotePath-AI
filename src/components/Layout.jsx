import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { ShieldCheck } from 'lucide-react';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
      
      {/* Trust Layer Footer */}
      <footer className="py-6 border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center text-gray-500 text-sm space-y-2 sm:space-y-0 sm:space-x-2">
          <ShieldCheck size={16} className="text-green-600" />
          <p>
            Information based on official guidelines from the 
            <a href="https://eci.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium ml-1">
              Election Commission of India
            </a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
