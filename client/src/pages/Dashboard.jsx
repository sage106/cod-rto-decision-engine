/**
 * Dashboard.jsx — Main dashboard page.
 * Orchestrates all dashboard sections in a clean grid layout:
 *   1. KPI Cards row
 *   2. Bucket Distribution chart + Regional breakdown table
 *   3. Order Simulator + WhatsApp Simulator
 *   4. Config Editor with live backtest results
 */
import React from 'react';
import useDashboardData from '../hooks/useDashboardData';
import KPICards from '../components/KPICards';
import BucketDistribution from '../components/BucketDistribution';
import RegionalHeatmap from '../components/RegionalHeatmap';
import OrderSimulator from '../components/OrderSimulator';
import WhatsAppSimulator from '../components/WhatsAppSimulator';
import ConfigEditor from '../components/ConfigEditor';

function Dashboard() {
  const { stats, regionalData, sourceData, courierData, loading, error, refetch } =
    useDashboardData();

  /* Loading state */
  if (loading) {
    return (
      <div className="dashboard-loading">
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  /* Error state */
  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Unable to Load Dashboard</h2>
        <p>{error}</p>
        <button className="btn btn--primary" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Section 1 — Key Performance Indicators */}
      <section className="dashboard__section">
        <h2 className="section-heading">Key Performance Indicators</h2>
        <KPICards totals={stats?.totals} />
      </section>

      {/* Section 2 — Distribution & Regional Analysis (two-column) */}
      <section className="dashboard__section">
        <div className="dashboard__grid dashboard__grid--2col">
          <div>
            <h2 className="section-heading">Bucket Distribution</h2>
            <BucketDistribution buckets={stats?.buckets} />
          </div>
          <div>
            <h2 className="section-heading">Regional and Channel Analysis</h2>
            <RegionalHeatmap
              regionalData={regionalData}
              sourceData={sourceData}
              courierData={courierData}
            />
          </div>
        </div>
      </section>

      {/* Section 3 — Simulators (two-column) */}
      <section className="dashboard__section">
        <div className="dashboard__grid dashboard__grid--2col">
          <div>
            <h2 className="section-heading">Order Simulator</h2>
            <OrderSimulator />
          </div>
          <div>
            <h2 className="section-heading">WhatsApp Confirmation Simulator</h2>
            <WhatsAppSimulator />
          </div>
        </div>
      </section>

      {/* Section 4 — Configuration & Backtesting (full-width) */}
      <section className="dashboard__section">
        <h2 className="section-heading">Configuration and Backtesting</h2>
        <ConfigEditor onConfigSaved={refetch} />
      </section>
    </div>
  );
}

export default Dashboard;
