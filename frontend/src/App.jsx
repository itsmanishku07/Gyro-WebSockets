import React, { useState } from 'react';
import PhoneController from './components/PhoneController';
import PcViewer from './components/PcViewer';

function App() {
  const [mode, setMode] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomCode.trim()) {
      setHasJoinedRoom(true);
    }
  };

  if (!hasJoinedRoom) {
    return (
      <div className="container">
        <h1>Gyro Visualizer</h1>
        <p style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '2rem' }}>Enter a room code to start pairing</p>
        <form onSubmit={handleJoinRoom} className="room-form">
          <input
            type="text"
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="room-input"
            maxLength={6}
          />
          <button type="submit" className="btn" style={{ marginTop: '1rem', width: '100%' }}>
            Join Room
          </button>
        </form>
      </div>
    );
  }

  if (mode === 'controller') {
    return <PhoneController roomCode={roomCode} onBack={() => setMode(null)} />;
  }

  if (mode === 'viewer') {
    return <PcViewer roomCode={roomCode} onBack={() => setMode(null)} />;
  }

  return (
    <div className="container">
      <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
        <button className="btn back-btn" onClick={() => setHasJoinedRoom(false)}>← Change Room</button>
      </div>
      <h1>Gyro 3D Visualizer</h1>
      <p style={{ fontSize: '1.1rem', color: '#3b82f6', marginBottom: '0.5rem', fontWeight: '600' }}>Room: {roomCode}</p>
      <p style={{ fontSize: '1rem', color: '#94a3b8' }}>Select the mode for this device:</p>
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
