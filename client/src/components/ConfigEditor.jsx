/**
 * ConfigEditor.jsx — Rule-engine configuration form with live backtesting.
 * Allows the user to adjust decision thresholds, select high-RTO states,
 * save the new configuration, and run a backtest to preview results.
 */
import React, { useState, useEffect } from 'react';
import { fetchConfig, updateConfig, runBacktest } from '../api/apiClient';
import BacktestResults from './BacktestResults';

/* Possible high-RTO states */
const ALL_HIGH_RTO_STATES = [
  'Bihar', 'Uttar Pradesh', 'Madhya Pradesh', 'Assam', 'Rajasthan',
];

function ConfigEditor({ onConfigSaved }) {
  const [config, setConfig] = useState({
    max_prior_rto: 2,
    high_value_threshold: 1800,
    mid_value_threshold: 1200,
    prepaid_discount: 50,
    high_rto_states: ['Bihar', 'Uttar Pradesh'],
  });

  const [backtestResult, setBacktestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const [message, setMessage] = useState(null);

  /* Load current config from backend on mount */
  useEffect(() => {
    fetchConfig()
      .then((res) => {
        const configData = res?.data || res;
        if (configData && typeof configData === 'object') {
          setConfig((prev) => ({ ...prev, ...configData }));
        }
      })
      .catch((err) => console.error('Config fetch failed:', err));
  }, []);

  /** Generic numeric field handler. */
  const handleNumber = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: Number(value) }));
  };

  /** Toggle a state in the high_rto_states array. */
  const toggleState = (state) => {
    setConfig((prev) => {
      const current = prev.high_rto_states || [];
      const updated = current.includes(state)
        ? current.filter((s) => s !== state)
        : [...current, state];
      return { ...prev, high_rto_states: updated };
    });
  };

  /** Save configuration to backend. */
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateConfig(config);
      setMessage({ type: 'success', text: 'Configuration saved successfully.' });
      if (onConfigSaved) onConfigSaved();
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  /** Run backtest with current config. */
  const handleBacktest = async () => {
    setBacktesting(true);
    setMessage(null);
    setBacktestResult(null);
    try {
      const res = await runBacktest(config);
      setBacktestResult(res);
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.error || err.message });
    } finally {
      setBacktesting(false);
    }
  };

  return (
    <div className="card config-editor">
      <div className="config-editor__form">
        {/* Numeric parameter inputs */}
        <div className="form-grid">
          {/* Max Prior RTO */}
          <label className="form-field">
            <span className="form-field__label">
              Max Prior RTO (1-5)
            </span>
            <input
              type="number" min="1" max="5"
              value={config.max_prior_rto}
              onChange={(e) => handleNumber('max_prior_rto', e.target.value)}
            />
          </label>

          {/* High Value Threshold */}
          <label className="form-field">
            <span className="form-field__label">
              High Value Threshold (Rs. 500-3000)
            </span>
            <input
              type="number" min="500" max="3000" step="50"
              value={config.high_value_threshold}
              onChange={(e) => handleNumber('high_value_threshold', e.target.value)}
            />
          </label>

          {/* Mid Value Threshold */}
          <label className="form-field">
            <span className="form-field__label">
              Mid Value Threshold (Rs. 500-2000)
            </span>
            <input
              type="number" min="500" max="2000" step="50"
              value={config.mid_value_threshold}
              onChange={(e) => handleNumber('mid_value_threshold', e.target.value)}
            />
          </label>

          {/* Prepaid Discount */}
          <label className="form-field">
            <span className="form-field__label">
              Prepaid Discount (Rs. 0-200)
            </span>
            <input
              type="number" min="0" max="200" step="10"
              value={config.prepaid_discount}
              onChange={(e) => handleNumber('prepaid_discount', e.target.value)}
            />
          </label>
        </div>

        {/* High-RTO state checkboxes */}
        <div className="config-editor__states">
          <span className="form-field__label">High-RTO States</span>
          <div className="checkbox-group">
            {ALL_HIGH_RTO_STATES.map((state) => (
              <label key={state} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={(config.high_rto_states || []).includes(state)}
                  onChange={() => toggleState(state)}
                />
                {state}
              </label>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="config-editor__actions">
          <button
            className="btn btn--primary"
            onClick={handleBacktest}
            disabled={backtesting}
          >
            {backtesting ? 'Running Backtest...' : 'Run Backtest with These Settings'}
          </button>
          <button
            className="btn btn--outline"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

        {/* Feedback message */}
        {message && (
          <div className={`alert alert--${message.type}`} style={{ marginTop: 12 }}>
            {message.text}
          </div>
        )}
      </div>

      {/* Backtest results panel */}
      {backtestResult && (
        <div style={{ marginTop: 24 }}>
          <BacktestResults results={backtestResult} />
        </div>
      )}
    </div>
  );
}

export default ConfigEditor;
