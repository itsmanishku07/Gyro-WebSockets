import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import SensorGraph from './SensorGraph';

const PhoneModel = ({ orientation }) => {
  const meshRef = useRef();
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const targetQuaternion = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    if (meshRef.current && orientation) {
      if (orientation.quat) {
        const q = orientation.quat;
        targetQuaternion.current.set(q.x, q.y, q.z, q.w);
        
        // Correct Phone-to-World mapping
        const worldCorrection = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        targetQuaternion.current.multiplyQuaternions(worldCorrection, targetQuaternion.current);
        
        meshRef.current.quaternion.slerp(targetQuaternion.current, 12 * delta);
      } else {
        const alpha = THREE.MathUtils.degToRad(orientation.alpha || 0);
        const beta = THREE.MathUtils.degToRad(orientation.beta || 0);
        const gamma = THREE.MathUtils.degToRad(orientation.gamma || 0);
        
        // Correct Euler mapping for Web Sensors
        targetEuler.current.set(beta, alpha, -gamma, 'YXZ');
        targetQuaternion.current.setFromEuler(targetEuler.current);
        meshRef.current.quaternion.slerp(targetQuaternion.current, 12 * delta); 
      }
    }
  });

  return (
    <group ref={meshRef}>
      {/* Main body */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[3, 0.4, 6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.21, 0]}>
        <boxGeometry args={[2.8, 0.01, 5.8]} />
        <meshStandardMaterial color="#000000" roughness={0.0} metalness={1.0} />
      </mesh>
      {/* Camera bump */}
      <mesh position={[0.8, -0.21, -2.2]}>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshStandardMaterial color="#334155" />
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
        <div style={{color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px'}}>Status</div>
        <div style={{marginBottom: '10px', color: status.includes('Error') ? '#ef4444' : '#22c55e'}}>{status}</div>
        
        <div style={{color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px'}}>Orientation</div>
        <div style={{fontFamily: 'monospace', fontSize: '1.1rem'}}>
          {orientation.quat ? (
            <div style={{fontSize: '0.9rem', color: '#3b82f6'}}>
              Precision Mode: ON<br/>
              X: {orientation.quat.x.toFixed(2)}<br/>
              Y: {orientation.quat.y.toFixed(2)}<br/>
              Z: {orientation.quat.z.toFixed(2)}
            </div>
          ) : (
            <>
              α: {(orientation.alpha || 0).toFixed(0)}°<br/>
              β: {(orientation.beta || 0).toFixed(0)}°<br/>
              γ: {(orientation.gamma || 0).toFixed(0)}°
            </>
          )}
        </div>
      </div>

      <Canvas camera={{ position: [0, 5, 8], fov: 50 }} shadows>
        <color attach="background" args={['#0f172a']} />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <PhoneModel orientation={orientation} />
        
        <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={20} blur={2} far={4} />
        <OrbitControls makeDefault />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default PcViewer;
