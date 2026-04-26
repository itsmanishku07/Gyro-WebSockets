import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import SensorGraph from './SensorGraph';
import PhoneScreenUI from './PhoneScreenUI';

const PhoneModel = ({ orientation }) => {
  const meshRef = useRef();
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const targetQuaternion = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    if (!meshRef.current || !orientation) return;

    if (orientation.quat) {
      // 100% Accurate Hardware Sync with Axis Correction
      const q = orientation.quat;
      // Map hardware (ENZ: East-North-Up) to Three.js world (Right-Up-Backward)
      // ENZ: X=East, Y=North, Z=Up
      // ThreeJS: X=Right, Y=Up, Z=Backward (South)
      // So Three.js X = ENZ X, Three.js Y = ENZ Z, Three.js Z = -ENZ Y
      targetQuaternion.current.set(q.x, q.z, -q.y, q.w);

      meshRef.current.quaternion.slerp(targetQuaternion.current, 15 * delta);
    } else {
      // Smooth Euler Fallback
      const alpha = THREE.MathUtils.degToRad(orientation.alpha || 0);
      const beta = THREE.MathUtils.degToRad(orientation.beta || 0);
      const gamma = THREE.MathUtils.degToRad(orientation.gamma || 0);

      // X: pitch (beta), Y: heading (alpha), Z: roll (gamma)
      targetEuler.current.set(beta, -alpha, -gamma, 'YXZ');
      targetQuaternion.current.setFromEuler(targetEuler.current);
      meshRef.current.quaternion.slerp(targetQuaternion.current, 15 * delta);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Main body - Rounded */}
      <RoundedBox args={[3, 0.4, 6]} radius={0.2} smoothness={8} receiveShadow castShadow>
        <meshStandardMaterial color="#1e293b" roughness={0.1} metalness={0.8} />
      </RoundedBox>
      
      {/* Screen - Rounded with valid radius */}
      <mesh position={[0, 0.11, 0]}>
        <RoundedBox args={[2.8, 0.2, 5.8]} radius={0.1} smoothness={8}>
          <meshStandardMaterial color="#000000" roughness={0.0} metalness={1.0} />
        </RoundedBox>
      </mesh>
      {/* Virtual UI overlay */}
      <PhoneScreenUI />
      {/* Camera bump - Also slightly rounded */}
      <mesh position={[0.8, -0.21, -2.2]}>
        <RoundedBox args={[1, 0.1, 1]} radius={0.05} smoothness={4}>
          <meshStandardMaterial color="#334155" />
        </RoundedBox>
      </mesh>
    </group>
  );
};

const PcViewer = ({ onBack }) => {
  const [status, setStatus] = useState('Connecting...');
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const lockedDeviceId = useRef(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setStatus('Connected. Waiting for phone data...');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Auto-lock onto the first device, but allow re-locking if the old device stops sending
        const now = Date.now();
        if (!lockedDeviceId.current || (now - lastMessageTime.current > 2000)) {
          lockedDeviceId.current = data.deviceId;
        }

        if (data.deviceId === lockedDeviceId.current) {
          setOrientation(data);
          setStatus(`Live Sync Active`);
          lastMessageTime.current = now;
        }
      } catch (e) {
        console.error("Failed to parse WS data", e);
      }
    };

    const lastMessageTime = { current: 0 };

    ws.onclose = () => {
      setStatus('Disconnected');
    };

    ws.onerror = () => {
      setStatus('Connection Error');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return (
    <div className="viewer-container">
      <button className="btn back-btn" onClick={onBack} style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 20 }}>← Back</button>
      <SensorGraph data={orientation} />

      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, background: 'rgba(30,41,59,0.8)', backdropFilter: 'blur(10px)', padding: '15px', borderRadius: '12px', color: 'white', textAlign: 'left', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</div>
        <div style={{ marginBottom: '10px', color: status.includes('Error') ? '#ef4444' : '#22c55e' }}>{status}</div>

        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Orientation</div>
        <div style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
          α: {(orientation.alpha || 0).toFixed(0)}°<br />
          β: {(orientation.beta || 0).toFixed(0)}°<br />
          γ: {(orientation.gamma || 0).toFixed(0)}°
          
          {orientation.quat && (
            <div style={{ fontSize: '0.9rem', color: '#3b82f6', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              Precision Mode: ON<br />
              X: {orientation.quat.x.toFixed(2)}<br />
              Y: {orientation.quat.y.toFixed(2)}<br />
              Z: {orientation.quat.z.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Canvas camera={{ position: [0, 5, 8], fov: 50 }} shadows>
          <color attach="background" args={['#0f172a']} />

          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          <PhoneModel orientation={orientation} />

          <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={20} blur={2} far={4} />
          <OrbitControls makeDefault enableRotate={false} enableZoom={false} enablePan={false} />
          <Environment preset="city" />
        </Canvas>
      </div>
    </div>
  );
};

export default PcViewer;
