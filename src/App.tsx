import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { AdminDashboard } from './components/AdminDashboard';

export const App: React.FC = () => (
  <>
    <AdminDashboard />
    <Analytics />
  </>
);

export default App;
