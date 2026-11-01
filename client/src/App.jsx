/**
 * App.jsx — Root application component.
 * Renders the header bar with application title and subtitle,
 * followed by the main Dashboard page.
 */
import React from 'react';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <div className="app">
      {/* Application header with branding */}
      <header className="app-header">
        <div className="app-header__content">
          <h1 className="app-header__title">COD RTO Decision Engine</h1>
          <p className="app-header__subtitle">Executive Dashboard</p>
        </div>
      </header>

      {/* Main dashboard content */}
      <main className="app-main">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
