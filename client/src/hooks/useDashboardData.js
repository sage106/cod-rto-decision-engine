/**
 * useDashboardData.js — Custom hook for loading dashboard analytics.
 * Fetches stats, regional data, UTM-source breakdown, and courier
 * breakdown in parallel on mount.  Exposes a refetch function so
 * consumers can refresh after config changes.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchDashboardStats,
  fetchRegionalData,
  fetchSourceBreakdown,
  fetchCourierBreakdown,
} from '../api/apiClient';

export default function useDashboardData() {
  const [stats, setStats] = useState(null);
  const [regionalData, setRegionalData] = useState([]);
  const [sourceData, setSourceData] = useState([]);
  const [courierData, setCourierData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /** Fetch all four data sets concurrently. */
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, regionalRes, sourceRes, courierRes] = await Promise.all([
        fetchDashboardStats(),
        fetchRegionalData(),
        fetchSourceBreakdown(),
        fetchCourierBreakdown(),
      ]);
      setStats(statsRes?.data || statsRes);
      setRegionalData(regionalRes?.data || regionalRes);
      setSourceData(sourceRes?.data || sourceRes);
      setCourierData(courierRes?.data || courierRes);
    } catch (err) {
      console.error('Dashboard data fetch failed:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial load on mount */
  useEffect(() => {
    refetch();
  }, [refetch]);

  return { stats, regionalData, sourceData, courierData, loading, error, refetch };
}
