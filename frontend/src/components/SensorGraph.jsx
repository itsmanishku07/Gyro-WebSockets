import React, { useEffect, useRef } from 'react';

const SensorGraph = ({ data }) => {
  const canvasRef = useRef(null);
  const history = useRef([]);
  const maxPoints = 200;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Add new data point to history
    const val = data.quat ? 
      { x: data.quat.x * 100, y: data.quat.y * 100, z: data.quat.z * 100 } : 
      { x: data.alpha, y: data.beta, z: data.gamma };
      
    history.current.push(val);
    if (history.current.length > maxPoints) history.current.shift();

    // Clear and Draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    const drawLine = (key, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      history.current.forEach((p, i) => {
        const x = (i / maxPoints) * canvas.width;
        // Center vertically and scale
        const y = (canvas.height / 2) - (p[key] * (canvas.height / 400));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    drawLine('x', '#ef4444'); // Red
    drawLine('y', '#22c55e'); // Green
    drawLine('z', '#3b82f6'); // Blue

  }, [data]);

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      background: 'rgba(15,23,42,0.8)',
      padding: '10px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)',
      zIndex: 10
    }}>
      <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: '5px', textTransform: 'uppercase' }}>Real-time XYZ Motion</div>
      <canvas ref={canvasRef} width={300} height={120} style={{ display: 'block' }} />
      <div style={{ display: 'flex', gap: '10px', marginTop: '5px', fontSize: '0.7rem' }}>
        <span style={{ color: '#ef4444' }}>● X</span>
        <span style={{ color: '#22c55e' }}>● Y</span>
        <span style={{ color: '#3b82f6' }}>● Z</span>
      </div>
    </div>
  );
};

export default SensorGraph;
