import React, { useState } from 'react';
import PhoneController from './components/PhoneController';
import PcViewer from './components/PcViewer';

function App() {
  const [mode, setMode] = useState(null);
  const [serverAddress, setServerAddress] = useState(window.location.host);
  const [useSecure, setUseSecure] = useState(window.location.protocol === 'https:');

  if (mode === 'controller') {
    return <PhoneController serverAddress={serverAddress} useSecure={useSecure} onBack={() => setMode(null)} />;
  }

  if (mode === 'viewer') {
    return <PcViewer serverAddress={serverAddress} useSecure={useSecure} onBack={() => setMode(null)} />;
  }

  const isPageSecure = window.location.protocol === 'https:';

  return (
    <div className="container" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
      padding: '20px',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: '800',
          background: 'linear-gradient(to right, #60a5fa, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem',
          letterSpacing: '-1px'
        }}>
          GyroSync 3D
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: '500px' }}>
          High-precision 1:1 motion synchronization for the modern web.
        </p>
      </div>

      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: 'rgba(30,41,59,0.4)',
        backdropFilter: 'blur(20px)',
        padding: '30px',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        marginBottom: '2rem'
      }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <label style={{ color: '#60a5fa', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Connection Node
            </label>
            <div style={{ display: 'flex', background: 'rgba(15,23,42,0.8)', borderRadius: '8px', padding: '4px' }}>
              <button
                onClick={() => setUseSecure(false)}
                style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '0.7rem', border: 'none', cursor: 'pointer',
                  background: !useSecure ? '#3b82f6' : 'transparent', color: 'white'
                }}
              >WS</button>
              <button
                onClick={() => setUseSecure(true)}
                style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '0.7rem', border: 'none', cursor: 'pointer',
                  background: useSecure ? '#3b82f6' : 'transparent', color: 'white'
                }}
              >WSS</button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={serverAddress}
              onChange={(e) => setServerAddress(e.target.value)}
              placeholder="EC2 IP or Localhost"
              style={{
                width: '100%',
                padding: '16px 20px',
                borderRadius: '12px',
                background: 'rgba(15,23,42,0.6)',
                border: `2px solid ${isPageSecure && !useSecure ? '#ef4444' : 'rgba(59,130,246,0.3)'}`,
                color: 'white',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s',
                fontFamily: 'monospace'
              }}
            />
          </div>

          {isPageSecure && !useSecure && (
            <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '12px', lineHeight: '1.4' }}>
              ⚠️ <strong>Mixed Content Error:</strong> You are on an HTTPS page but selected WS. Browsers will block this. Please switch your browser URL to <strong>http://</strong> or use <strong>WSS</strong>.
            </p>
          )}

          {!isPageSecure && (
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '12px' }}>
              Tip: Enter your EC2 <span style={{ color: '#94a3b8' }}>Public IP:Port</span>.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <button
            onClick={() => setMode('viewer')}
            className="btn"
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '1.1rem',
              fontWeight: '600',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: isPageSecure && !useSecure ? 0.5 : 1
            }}
            disabled={isPageSecure && !useSecure}
          >
            <span>Launch PC Viewer</span>
            <span style={{ opacity: 0.7 }}>🖥️</span>
          </button>

          <button
            onClick={() => setMode('controller')}
            className="btn"
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '1.1rem',
              fontWeight: '600',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: isPageSecure && !useSecure ? 0.5 : 1
            }}
            disabled={isPageSecure && !useSecure}
          >
            <span>Connect Phone Controller</span>
            <span style={{ opacity: 0.7 }}>📱</span>
          </button>
        </div>
      </div>

      <div style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center' }}>
        Designed for Low-Latency Real-time Interaction
      </div>
    </div>
  );
}

export default App;
