import React, { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';

const PhoneScreenUI = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const apps = [
    { name: 'Phone', color: '#22c55e', icon: '📞' },
    { name: 'Messages', color: '#3b82f6', icon: '💬' },
    { name: 'Browser', color: '#0ea5e9', icon: '🌐' },
    { name: 'Camera', color: '#a8a29e', icon: '📸' },
    { name: 'Mail', color: '#ef4444', icon: '✉️' },
    { name: 'Settings', color: '#64748b', icon: '⚙️' },
    { name: 'Maps', color: '#10b981', icon: '🗺️' },
    { name: 'Photos', color: '#f59e0b', icon: '🖼️' },
  ];

  return (
    <Html
      transform
      occlude
      position={[0, 0.23, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={0.31}
    >
      <div style={{
        width: '375px',
        height: '777px', // Matches the 5.8 3D length
        background: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop") center/cover',
        borderRadius: '48px',
        padding: '20px',
        color: 'white',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: 'none',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}>
        {/* Dark overlay for readability */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Status Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '600', padding: '5px 15px 0' }}>
            <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>5G</span>
              <span style={{ fontSize: '12px' }}>📶</span>
              <span style={{ fontSize: '12px' }}>🔋</span>
            </div>
          </div>

          {/* Date/Time Widget */}
          <div style={{ textAlign: 'center', marginTop: '60px', marginBottom: '80px', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '72px', fontWeight: '300', letterSpacing: '-1px' }}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: '20px', fontWeight: '500', marginTop: '5px' }}>
              {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {/* App Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '25px 15px', padding: '0 10px' }}>
            {apps.map((app) => (
              <div key={app.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: app.color,
                  borderRadius: '18px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '32px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                  onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                  onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  onPointerLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {app.icon}
                </div>
                <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '600', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{app.name}</span>
              </div>
            ))}
          </div>

          {/* Bottom Dock */}
          <div style={{
            marginTop: 'auto',
            background: 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(20px)',
            borderRadius: '30px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-around',
            marginBottom: '10px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            {apps.slice(0, 4).map((app) => (
              <div key={'dock-' + app.name} style={{
                width: '60px',
                height: '60px',
                backgroundColor: app.color,
                borderRadius: '16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '30px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                cursor: 'pointer',
              }}
                onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onPointerLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {app.icon}
              </div>
            ))}
          </div>

          {/* Home Indicator */}
          <div style={{
            width: '120px',
            height: '5px',
            backgroundColor: 'rgba(255,255,255,0.8)',
            borderRadius: '3px',
            margin: '10px auto 0',
          }} />
        </div>
      </div>
    </Html>
  );
};

export default PhoneScreenUI;
