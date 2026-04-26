import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import PhoneScreenUI from './PhoneScreenUI';

const LocalPhoneModel = ({ orientationRef, selectedModel }) => {
  const meshRef = useRef();
  const targetQ = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    if (!meshRef.current || !orientationRef.current) return;
    const { quat, alpha, beta, gamma } = orientationRef.current;
    
    if (quat) {
      targetQ.current.set(quat.x, quat.z, -quat.y, quat.w);
    } else {
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(beta || 0), 
        -THREE.MathUtils.degToRad(alpha || 0), 
        -THREE.MathUtils.degToRad(gamma || 0), 
        'YXZ'
      );
      targetQ.current.setFromEuler(euler);
    }
    meshRef.current.quaternion.slerp(targetQ.current, 25 * delta); // Snappier sync
  });

  const renderShape = () => {
    switch(selectedModel) {
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

  const color = '#ffffff';

  if (selectedModel !== 'phone') {
    const shape = renderShape();
    return (
      <group ref={meshRef}>
        {shape.type === 'group' ? shape : (
          <mesh castShadow receiveShadow>
            {shape}
            <meshStandardMaterial color={color} roughness={0.2} metalness={0.7} />
          </mesh>
        )}
      </group>
    );
  }

  return (
    <group ref={meshRef}>
      <RoundedBox args={[3, 0.4, 6]} radius={0.2} smoothness={8} receiveShadow castShadow>
        <meshStandardMaterial color="#3b82f6" roughness={0.1} metalness={0.8} />
      </RoundedBox>
      <mesh position={[0, 0.11, 0]}>
        <RoundedBox args={[2.8, 0.2, 5.8]} radius={0.1} smoothness={8}>
          <meshStandardMaterial color="#000000" roughness={0.0} metalness={1.0} />
        </RoundedBox>
      </mesh>
      <PhoneScreenUI />
    </group>
  );
};

const PhoneController = ({ roomCode, onBack }) => {
  const [status, setStatus] = useState('Idle');
  const [uiData, setUiData] = useState({ alpha: 0, beta: 0, gamma: 0, raw: '' });
  const [selectedModel, setSelectedModel] = useState('phone');
  const [isTracking, setIsTracking] = useState(false);
  
  const orientationRef = useRef({ alpha: 0, beta: 0, gamma: 0, quat: null });
  const rawData = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const offsets = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const calibrationQuat = useRef(new THREE.Quaternion());
  const wsRef = useRef(null);
  const deviceId = useRef(Math.random().toString(36).substring(7));
  const sensorRef = useRef(null);
  const lastSendTime = useRef(0);
  const smoothedData = useRef({ alpha: 0, beta: 0, gamma: 0, init: false });

  const lerpAngle = (start, end, amount) => {
    let diff = end - start;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    return start + diff * amount;
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomCode}`);
    ws.onopen = () => { setStatus('Connected'); wsRef.current = ws; };
    ws.onclose = () => { setStatus('Disconnected'); wsRef.current = null; };
    ws.onerror = () => setStatus('Connection Error');
    return () => ws.readyState === WebSocket.OPEN && ws.close();
  }, [roomCode]);

  // Throttled UI Update (10Hz)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isTracking) {
        setUiData({ ...orientationRef.current });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isTracking]);

  const handleOrientation = (event) => {
    if (event.alpha === null) return;
    rawData.current = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };

    const wrapAlpha = (val) => { while (val < 0) val += 360; while (val >= 360) val -= 360; return val; };
    let a = wrapAlpha(rawData.current.alpha - offsets.current.alpha);
    let b = rawData.current.beta  - offsets.current.beta;
    let g = rawData.current.gamma - offsets.current.gamma;

    if (!smoothedData.current.init) {
      smoothedData.current = { alpha: a, beta: b, gamma: g, init: true };
    } else {
      smoothedData.current.alpha = wrapAlpha(lerpAngle(smoothedData.current.alpha, a, 0.4));
      smoothedData.current.beta = lerpAngle(smoothedData.current.beta, b, 0.3);
      smoothedData.current.gamma = lerpAngle(smoothedData.current.gamma, g, 0.3);
    }

    orientationRef.current = {
      alpha: smoothedData.current.alpha,
      beta:  smoothedData.current.beta,
      gamma: smoothedData.current.gamma,
      quat: null,
      raw: 'Standard Mode'
    };
    sendData();
  };

  const sendData = () => {
    const now = Date.now();
    if (now - lastSendTime.current > 16) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          ...orientationRef.current,
          deviceId: deviceId.current,
          modelId: selectedModel
        }));
      }
      lastSendTime.current = now;
    }
  };

  const calibrate = () => {
    offsets.current = { ...rawData.current };
    smoothedData.current = { alpha: 0, beta: 0, gamma: 0, init: true };
    if (orientationRef.current.quat) {
      const q = orientationRef.current.quat;
      calibrationQuat.current.set(q.x, q.y, q.z, q.w).invert();
    }
    setStatus('Calibrated');
  };

  const startSensors = async () => {
    setIsTracking(true);
    if (window.AbsoluteOrientationSensor) {
      try {
        const sensor = new AbsoluteOrientationSensor({ frequency: 60, referenceFrame: 'device' });
        sensorRef.current = sensor;
        sensor.addEventListener('reading', () => {
          const [sx, sy, sz, sw] = sensor.quaternion;
          const rawQ = new THREE.Quaternion(sx, sy, sz, sw);
          const relQ = new THREE.Quaternion().multiplyQuaternions(calibrationQuat.current, rawQ);
          const tempEuler = new THREE.Euler().setFromQuaternion(relQ, 'YXZ');
          
          orientationRef.current = {
            alpha: THREE.MathUtils.radToDeg(tempEuler.y),
            beta: THREE.MathUtils.radToDeg(tempEuler.x),
            gamma: THREE.MathUtils.radToDeg(tempEuler.z),
            quat: { x: relQ.x, y: relQ.y, z: relQ.z, w: relQ.w },
            raw: 'Precision Mode'
          };
          sendData();
        });
        sensor.start();
        setStatus('Precision Active');
        return;
      } catch (e) { console.warn(e); }
    }
    window.addEventListener('deviceorientation', handleOrientation);
    setStatus('Standard Active');
  };

  const stopSensors = () => {
    setIsTracking(false);
    sensorRef.current?.stop();
    window.removeEventListener('deviceorientation', handleOrientation);
    setStatus('Stopped');
  };

  const changeModel = (id) => {
    setSelectedModel(id);
    if ('vibrate' in navigator) navigator.vibrate(50);
    wsRef.current?.send(JSON.stringify({ type: 'model_change', modelId: id, deviceId: deviceId.current }));
  };

  return (
    <div className="phone-container">
      <button className="btn back-btn" onClick={onBack}>← Back</button>
      <h1 className="title">Controller</h1>
      <div className={`status ${status.includes('Error') ? 'error' : 'success'}`} style={{ width: '100%' }}>
        Status: <strong>{status}</strong>
      </div>
      <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '1rem' }}>
        <button className="btn" onClick={isTracking ? stopSensors : startSensors} style={{ flex: 1, backgroundColor: isTracking ? '#ef4444' : '#22c55e' }}>
          {isTracking ? 'Stop' : 'Start'}
        </button>
        <button className="btn" onClick={calibrate} style={{ flex: 1, backgroundColor: '#3b82f6' }}>Reset</button>
      </div>
      <div className="data-card">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Alpha</span><span>{uiData.alpha.toFixed(1)}°</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Beta</span><span>{uiData.beta.toFixed(1)}°</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gamma</span><span>{uiData.gamma.toFixed(1)}°</span></div>
      </div>
      <div style={{ width: '100%', height: '300px', marginTop: '1rem', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Canvas camera={{ position: [0, 5, 8], fov: 50 }}>
          <color attach="background" args={['#1e293b']} />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} intensity={1} />
          <LocalPhoneModel orientationRef={orientationRef} selectedModel={selectedModel} />
          <Environment preset="city" />
        </Canvas>
      </div>
      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
        {['phone', 'dna', 'atom', 'hourglass'].map(id => (
          <button key={id} onClick={() => changeModel(id)} className="btn" style={{ background: selectedModel === id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', borderColor: selectedModel === id ? '#3b82f6' : 'transparent' }}>
            {id.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PhoneController;
