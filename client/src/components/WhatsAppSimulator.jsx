/**
 * WhatsAppSimulator.jsx — Business messaging simulator.
 * Provides a chat-like interface for testing the WhatsApp confirmation
 * and prepaid-nudge flows.  Users can start a session, send replies,
 * and simulate timeout events (12h / 24h).
 *
 * Outbound (system) messages are aligned left; inbound (customer)
 * messages are aligned right.  Professional styling — no green
 * backgrounds or informal design elements.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  startWhatsAppSession,
  sendWhatsAppReply,
  simulateTimeout,
  getWhatsAppSession,
} from '../api/apiClient';

/* Badge colour based on session state string */
function stateBadge(state) {
  if (!state) return 'badge--neutral';
  const s = state.toLowerCase();
  if (s.includes('confirmed') || s.includes('converted') || s.includes('completed'))
    return 'badge--success';
  if (s.includes('cancelled') || s.includes('cancel') || s.includes('expired'))
    return 'badge--danger';
  if (s.includes('pending') || s.includes('wait'))
    return 'badge--warning';
  return 'badge--primary';
}

function WhatsAppSimulator() {
  const [orderId, setOrderId] = useState('');
  const [flowType, setFlowType] = useState('confirmation');
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  /* Auto-scroll to latest message */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** Extract messages from a session response and append new ones. */
  const updateFromSession = (sessionData) => {
    setSession(sessionData);
    if (sessionData?.messages) {
      setMessages(sessionData.messages);
    } else if (sessionData?.conversation) {
      setMessages(sessionData.conversation);
    }
  };

  /** Start a brand-new WhatsApp session. */
  const handleStart = async () => {
    if (!orderId.trim()) return;
    setLoading(true);
    setError(null);
    setMessages([]);
    setSession(null);
    try {
      const res = await startWhatsAppSession(orderId.trim(), flowType, {
        order_id: orderId.trim(),
        customer_name: 'Amit Kumar',
        items: 'Anti-Hairfall Shampoo 250ml',
        order_value: 649,
        address: 'Flat 204, Green Meadows, Civil Lines',
        city: 'Jaipur',
      });
      updateFromSession(res.data || res.session || res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Send a free-text reply from the customer side. */
  const handleReply = async (text) => {
    const reply = text || replyText;
    if (!reply.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await sendWhatsAppReply(orderId.trim(), reply.trim());
      updateFromSession(res.session || res);
      setReplyText('');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Simulate a timeout event. */
  const handleTimeout = async (type) => {
    setLoading(true);
    setError(null);
    try {
      const res = await simulateTimeout(orderId.trim(), type);
      updateFromSession(res.session || res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card whatsapp-simulator">
      {/* Session start form */}
      <div className="wa-start-form">
        <label className="form-field">
          <span className="form-field__label">Order ID</span>
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g. ORD-1001"
          />
        </label>
        <label className="form-field">
          <span className="form-field__label">Flow Type</span>
          <select value={flowType} onChange={(e) => setFlowType(e.target.value)}>
            <option value="confirmation">Confirmation</option>
            <option value="prepaid_nudge">Prepaid Nudge</option>
          </select>
        </label>
        <button
          className="btn btn--primary btn--small"
          onClick={handleStart}
          disabled={loading || !orderId.trim()}
        >
          Start Session
        </button>
      </div>

      {/* Error display */}
      {error && <div className="alert alert--danger">{error}</div>}

      {/* Session status badge */}
      {session && (
        <div className="wa-status">
          <span className="wa-status-label">Session Status:</span>
          <span className={`badge ${stateBadge(session.state || session.status)}`}>
            {session.state || session.status || 'Active'}
          </span>
        </div>
      )}

      {/* Chat message area */}
      <div className="wa-chat-area">
        {messages.length === 0 && (
          <p className="muted-text wa-chat-empty">
            Start a session to see messages here.
          </p>
        )}
        {messages.map((msg, idx) => {
          const isOutbound =
            msg.direction === 'outbound' || msg.from === 'system' || msg.sender === 'system';
          return (
            <div
              key={idx}
              className={`wa-message ${isOutbound ? 'wa-message--outbound' : 'wa-message--inbound'}`}
            >
              <div className="wa-message__bubble">
                <span className="wa-message__sender">
                  {isOutbound ? 'System' : 'Customer'}
                </span>
                <p className="wa-message__text">{msg.text || msg.content || msg.message}</p>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Reply input */}
      {session && (
        <>
          <div className="wa-reply-bar">
            <input
              type="text"
              className="wa-reply-input"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type a customer reply..."
              onKeyDown={(e) => e.key === 'Enter' && handleReply()}
            />
            <button
              className="btn btn--primary btn--small"
              onClick={() => handleReply()}
              disabled={loading || !replyText.trim()}
            >
              Send Reply
            </button>
          </div>

          {/* Quick-action buttons */}
          <div className="wa-actions">
            <button
              className="btn btn--outline btn--small"
              onClick={() => handleReply('YES')}
              disabled={loading}
            >
              Simulate: Reply YES
            </button>
            <button
              className="btn btn--outline btn--small"
              onClick={() => handleReply('NO')}
              disabled={loading}
            >
              Simulate: Reply NO
            </button>
            <button
              className="btn btn--outline btn--small"
              onClick={() => handleTimeout('12h')}
              disabled={loading}
            >
              Simulate: 12h Timeout
            </button>
            <button
              className="btn btn--outline btn--small"
              onClick={() => handleTimeout('24h')}
              disabled={loading}
            >
              Simulate: 24h Timeout
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default WhatsAppSimulator;
