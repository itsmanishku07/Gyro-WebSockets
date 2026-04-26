import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import SensorGraph from './SensorGraph';
import PhoneScreenUI from './PhoneScreenUI';

const PrimitiveModel = ({ orientation, type }) => {
  const meshRef = useRef();
  useFrame((state, delta) => {
    if (!meshRef.current || !orientation) return;
    const q = orientation.quat ? new THREE.Quaternion(orientation.quat.x, orientation.quat.z, -orientation.quat.y, orientation.quat.w) : 
              new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(orientation.beta || 0), -THREE.MathUtils.degToRad(orientation.alpha || 0), -THREE.MathUtils.degToRad(orientation.gamma || 0), 'YXZ'));
    meshRef.current.quaternion.slerp(q, 15 * delta);
  });

  const renderShape = () => {
    switch(type) {
      case 'dna': return (
        <group>
          {[...Array(12)].map((_, i) => (
            <group key={i} position={[0, (i - 6) * 0.5, 0]} rotation={[0, i * 0.5, 0]}>
              <mesh position={[1.2, 0, 0]}><sphereGeometry args={[0.2]} /><meshStandardMaterial color="#ef4444" /></mesh>
              <mesh position={[-1.2, 0, 0]}><sphereGeometry args={[0.2]} /><meshStandardMaterial color="#3b82f6" /></mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 2.4]} /><meshStandardMaterial color="#94a3b8" /></mesh>
            </group>
          ))}
        </group>
      );
      case 'atom': return (
        <group>
          <mesh><sphereGeometry args={[0.6]} /><meshStandardMaterial color="#ef4444" /></mesh>
          <mesh rotation={[Math.PI / 4, 0, 0]}><torusGeometry args={[2, 0.05, 16, 100]} /><meshStandardMaterial color="#3b82f6" /></mesh>
          <mesh rotation={[-Math.PI / 4, 0, 0]}><torusGeometry args={[2, 0.05, 16, 100]} /><meshStandardMaterial color="#22c55e" /></mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[2, 0.05, 16, 100]} /><meshStandardMaterial color="#f59e0b" /></mesh>
        </group>
      );
      case 'hourglass': return (
        <group>
          <mesh position={[0, 1.5, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[1.5, 3, 32]} /><meshStandardMaterial color="#fcd34d" transparent opacity={0.6} /></mesh>
          <mesh position={[0, -1.5, 0]}><coneGeometry args={[1.5, 3, 32]} /><meshStandardMaterial color="#fcd34d" transparent opacity={0.6} /></mesh>
        </group>
      );
      default: return null;
    }
  };

  const shape = renderShape();
  if (!shape) return null;

  return (
    <group ref={meshRef}>
      {shape.type === 'group' ? shape : (
        <mesh castShadow receiveShadow>
          {shape}
          <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.7} />
        </mesh>
      )}
    </group>
  );
};

const PhoneModel = ({ orientation }) => {
  const meshRef = useRef();
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const targetQuaternion = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    if (!meshRef.current || !orientation) return;

    if (orientation.quat) {
      const q = orientation.quat;
      targetQuaternion.current.set(q.x, q.z, -q.y, q.w);
      meshRef.current.quaternion.slerp(targetQuaternion.current, 15 * delta);
    } else {
      const alpha = THREE.MathUtils.degToRad(orientation.alpha || 0);
      const beta = THREE.MathUtils.degToRad(orientation.beta || 0);
      const gamma = THREE.MathUtils.degToRad(orientation.gamma || 0);
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
      <PhoneScreenUI />
      {/* Camera bump - Also slightly rounded */}
      <mesh position={[0.8, -0.21, -2.2]}>
        <RoundedBox args={[1, 0.1, 1]} radius={0.05} smoothness={8}>
          <meshStandardMaterial color="#334155" />
        </RoundedBox>
      </mesh>
    </group>
  );
};

const PcViewer = ({ onBack }) => {
  const [status, setStatus] = useState('Connecting...');
  const [selectedModel, setSelectedModel] = useState('phone');
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const lockedDeviceId = useRef(null);
  
  const models = [
    { id: 'phone', name: 'Smartphone' },
    { id: 'dna', name: 'DNA Helix' },
    { id: 'atom', name: 'Atom Structure' },
    { id: 'hourglass', name: 'Time Glass' },
  ];

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setStatus('Connected. Waiting for phone data...');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle model change requests from the phone
        if (data.type === 'model_change') {
          setSelectedModel(data.modelId);
          return;
        }

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

          {selectedModel === 'phone' ? (
            <PhoneModel orientation={orientation} />
          ) : (
            <PrimitiveModel orientation={orientation} type={selectedModel} />
          )}

          <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={20} blur={2} far={4} />
          <OrbitControls makeDefault enableRotate={false} enableZoom={false} enablePan={false} />
          <Environment preset="city" />
        </Canvas>
      </div>
    </div>
  );
};

export default PcViewer;
