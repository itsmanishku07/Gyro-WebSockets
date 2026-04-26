import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import SensorGraph from './SensorGraph';
import PhoneScreenUI from './PhoneScreenUI';

const PrimitiveModel = ({ deviceId, devicesRef, type }) => {
  const meshRef = useRef();
  useFrame((state, delta) => {
    const orientation = devicesRef.current[deviceId];
    if (!meshRef.current || !orientation) return;
    const q = orientation.quat ? new THREE.Quaternion(orientation.quat.x, orientation.quat.z, -orientation.quat.y, orientation.quat.w) : 
              new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(orientation.beta || 0), -THREE.MathUtils.degToRad(orientation.alpha || 0), -THREE.MathUtils.degToRad(orientation.gamma || 0), 'YXZ'));
    meshRef.current.quaternion.slerp(q, 25 * delta); // Increased slerp speed
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

const PhoneModel = ({ deviceId, devicesRef }) => {
  const meshRef = useRef();
  const targetQuaternion = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    const orientation = devicesRef.current[deviceId];
    if (!meshRef.current || !orientation) return;

    if (orientation.quat) {
      const q = orientation.quat;
      targetQuaternion.current.set(q.x, q.z, -q.y, q.w);
    } else {
      const alpha = THREE.MathUtils.degToRad(orientation.alpha || 0);
      const beta = THREE.MathUtils.degToRad(orientation.beta || 0);
      const gamma = THREE.MathUtils.degToRad(orientation.gamma || 0);
      targetQuaternion.current.setFromEuler(new THREE.Euler(beta, -alpha, -gamma, 'YXZ'));
    }
    meshRef.current.quaternion.slerp(targetQuaternion.current, 25 * delta); // Increased slerp speed
  });

  return (
    <group ref={meshRef}>
      <RoundedBox args={[3, 0.4, 6]} radius={0.2} smoothness={8} receiveShadow castShadow>
        <meshStandardMaterial color="#1e293b" roughness={0.1} metalness={0.8} />
      </RoundedBox>
      <mesh position={[0, 0.11, 0]}>
        <RoundedBox args={[2.8, 0.2, 5.8]} radius={0.1} smoothness={8}>
          <meshStandardMaterial color="#000000" roughness={0.0} metalness={1.0} />
        </RoundedBox>
      </mesh>
      <PhoneScreenUI />
      <mesh position={[0.8, -0.21, -2.2]}>
        <RoundedBox args={[1, 0.1, 1]} radius={0.05} smoothness={8}>
          <meshStandardMaterial color="#334155" />
        </RoundedBox>
      </mesh>
    </group>
  );
};

const PcViewer = ({ roomCode, onBack }) => {
  const [status, setStatus] = useState('Connecting...');
  const [deviceIds, setDeviceIds] = useState([]);
  const [uiOrientation, setUiOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const devicesRef = useRef({});
  const lastActiveDevice = useRef(null);
  
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomCode}`);

    ws.onopen = () => setStatus('Connected. Waiting for data...');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const now = Date.now();

        if (data.deviceId) {
          const isNew = !devicesRef.current[data.deviceId];
          
          devicesRef.current[data.deviceId] = {
            ...devicesRef.current[data.deviceId],
            ...data,
            lastSeen: now,
            modelId: data.type === 'model_change' ? data.modelId : (data.modelId || devicesRef.current[data.deviceId]?.modelId || 'phone')
          };
          
          lastActiveDevice.current = data.deviceId;
          if (status !== 'Live Sync Active') setStatus('Live Sync Active');
          
          if (isNew) {
            setDeviceIds(Object.keys(devicesRef.current));
          }
        }
      } catch (e) {
        console.error("Failed to parse WS data", e);
      }
    };

    ws.onclose = () => setStatus('Disconnected');
    ws.onerror = () => setStatus('Connection Error');

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [roomCode, status]);

  // Throttled UI Updates (10Hz) and Cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Cleanup
      let changed = false;
      const currentIds = Object.keys(devicesRef.current);
      currentIds.forEach(id => {
        if (now - devicesRef.current[id].lastSeen > 5000) {
          delete devicesRef.current[id];
          changed = true;
        }
      });
      if (changed) setDeviceIds(Object.keys(devicesRef.current));

      // UI Update
      if (lastActiveDevice.current && devicesRef.current[lastActiveDevice.current]) {
        setUiOrientation({ ...devicesRef.current[lastActiveDevice.current] });
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="viewer-container">
      <button className="btn back-btn" onClick={onBack}>← Back</button>
      <SensorGraph data={uiOrientation} />

      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10, background: 'rgba(30,41,59,0.8)', backdropFilter: 'blur(10px)', padding: '15px', borderRadius: '12px', color: 'white', border: '1px solid rgba(255,255,255,0.1)', minWidth: '200px' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase' }}>Status</div>
        <div style={{ marginBottom: '10px', color: status.includes('Error') ? '#ef4444' : '#22c55e' }}>{status}</div>
        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '5px', textTransform: 'uppercase' }}>Devices: {deviceIds.length}</div>
        
        {deviceIds.length > 0 && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#3b82f6', fontSize: '0.7rem', marginBottom: '5px' }}>ACTIVE: {lastActiveDevice.current?.substring(0, 4)}</div>
            <div style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
              α: {uiOrientation.alpha.toFixed(0)}°<br />
              β: {uiOrientation.beta.toFixed(0)}°<br />
              γ: {uiOrientation.gamma.toFixed(0)}°
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Canvas camera={{ position: [0, 5, 12], fov: 50 }} shadows>
          <color attach="background" args={['#0f172a']} />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />

          {deviceIds.map((id, index) => {
            const dev = devicesRef.current[id];
            if (!dev) return null;
            const xPos = (index - (deviceIds.length - 1) / 2) * 5;
            
            return (
              <group key={id} position={[xPos, 0, 0]}>
                {dev.modelId === 'phone' ? (
                  <PhoneModel deviceId={id} devicesRef={devicesRef} />
                ) : (
                  <PrimitiveModel deviceId={id} devicesRef={devicesRef} type={dev.modelId} />
                )}
                <Html position={[0, 4, 0]} center>
                  <div style={{ background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', color: 'white', fontSize: '10px', pointerEvents: 'none' }}>
                    {id.substring(0, 4)}
                  </div>
                </Html>
              </group>
            );
          })}

          <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={30} blur={2} far={4} />
          <OrbitControls makeDefault />
          <Environment preset="city" />
        </Canvas>
      </div>
    </div>
  );
};

export default PcViewer;
