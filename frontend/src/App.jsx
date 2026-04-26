import React, { useState } from 'react';
import PhoneController from './components/PhoneController';
import PcViewer from './components/PcViewer';

function App() {
  const [mode, setMode] = useState(null);

  if (mode === 'controller') {
    return <PhoneController onBack={() => setMode(null)} />;
  }

  if (mode === 'viewer') {
    return <PcViewer onBack={() => setMode(null)} />;
  }

  return (
    <div className="container">
      <h1>Gyro 3D Visualizer</h1>
      <p style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Select the mode for this device:</p>
      <div className="button-group">
        <button onClick={() => setMode('controller')} className="btn">
          Phone (Controller)
        </button>
        <button onClick={() => setMode('viewer')} className="btn">
          PC (Viewer)
        </button>
      </div>
    </div>
  );
}

export default App;
