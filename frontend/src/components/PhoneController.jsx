import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import PhoneScreenUI from './PhoneScreenUI';

const LocalPhoneModel = ({ orientation, quatOverride, selectedModel }) => {
  const meshRef = useRef();
  const targetQ = useRef(new THREE.Quaternion());

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    if (quatOverride) {
      const q = quatOverride;
      targetQ.current.set(q.x, q.z, -q.y, q.w);
    } else if (orientation) {
      const alpha = THREE.MathUtils.degToRad(orientation.alpha || 0);
      const beta  = THREE.MathUtils.degToRad(orientation.beta  || 0);
      const gamma = THREE.MathUtils.degToRad(orientation.gamma || 0);
      const euler = new THREE.Euler(beta, -alpha, -gamma, 'YXZ');
      targetQ.current.setFromEuler(euler);
    }
    meshRef.current.quaternion.slerp(targetQ.current, 15 * delta);
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

const PhoneController = ({ onBack }) => {
  const [status, setStatus] = useState('Idle');
  const [data, setData] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [quat, setQuat] = useState(null);
  const [selectedModel, setSelectedModel] = useState('phone');
  const [isTracking, setIsTracking] = useState(false);
  const [offsets, setOffsets] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [enabledAxes, setEnabledAxes] = useState({ alpha: true, beta: true, gamma: true });
  const wsRef = useRef(null);
  const lastSendTime = useRef(0);
  const smoothedData = useRef({ alpha: 0, beta: 0, gamma: 0, init: false });
  const rawData = useRef({ alpha: 0, beta: 0, gamma: 0 });

  // Shortest path angle interpolation to prevent 360-degree jumps
  const lerpAngle = (start, end, amount) => {
    let diff = end - start;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    return start + diff * amount;
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setStatus('Connected to Server');
      wsRef.current = ws;
    };

    ws.onclose = () => {
      setStatus('Disconnected');
      wsRef.current = null;
    };

    ws.onerror = (err) => {
      setStatus('Connection Error');
      console.error(err);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const handleOrientation = (event) => {
    if (event.alpha === null && event.beta === null && event.gamma === null) return;

    // Store raw data for calibration
    rawData.current = {
      alpha: event.alpha || 0,
      beta:  event.beta  || 0,
      gamma: event.gamma || 0
    };

    // Apply calibration offsets - wrap only alpha (compass, 0-360)
    // beta/gamma are SIGNED angles (-180..180) — do NOT wrap to 0-360
    const wrapAlpha = (val) => { while (val < 0) val += 360; while (val >= 360) val -= 360; return val; };
    let a = wrapAlpha(rawData.current.alpha - offsets.alpha);
    let b = rawData.current.beta  - offsets.beta;   // signed, no wrap
    let g = rawData.current.gamma - offsets.gamma;  // signed, no wrap

    if (!smoothedData.current.init) {
      smoothedData.current = { alpha: a, beta: b, gamma: g, init: true };
    } else {
      const tiltSmooth = 0.3; // faster tilt response for 1:1 feel

      // ALPHA (Compass/Heading) — fast lerp so heading tracks in real-time
      if (enabledAxes.alpha) {
        smoothedData.current.alpha = wrapAlpha(lerpAngle(smoothedData.current.alpha, a, 0.4));
      }

      // BETA (forward/back tilt)
      if (enabledAxes.beta) {
        smoothedData.current.beta = lerpAngle(smoothedData.current.beta, b, tiltSmooth);
      }

      // GAMMA (left/right tilt)
      if (enabledAxes.gamma) {
        smoothedData.current.gamma = lerpAngle(smoothedData.current.gamma, g, tiltSmooth);
      }
    }

    const orientationData = {
      alpha: smoothedData.current.alpha,
      beta:  smoothedData.current.beta,
      gamma: smoothedData.current.gamma,
      raw: 'Euler Mode Active'
    };
    sendData(orientationData);
  };

  // devicemotion is only used as a fallback when deviceorientation is unavailable
  const handleMotion = (event) => {
    // Skip if deviceorientation is already providing data
    if (smoothedData.current.init) return;
    if (!event.accelerationIncludingGravity || event.accelerationIncludingGravity.x === null) return;

    const acc = event.accelerationIncludingGravity;
    const b = Math.atan2(-acc.y, acc.z) * (180 / Math.PI);
    const g = Math.atan2(acc.x, Math.sqrt(acc.y * acc.y + acc.z * acc.z)) * (180 / Math.PI);

    smoothedData.current = { alpha: 0, beta: b, gamma: g, init: true };

    sendData({
      alpha: 0,
      beta: smoothedData.current.beta,
      gamma: smoothedData.current.gamma,
      raw: 'Motion Fallback Active'
    });
  };

  const deviceId = useRef(Math.random().toString(36).substring(7));

  const sendData = (orientationData) => {
    setData(orientationData);
    const now = Date.now();
    // High-speed sync: 16ms = 60fps. This removes the stuttering/flicker.
    if (now - lastSendTime.current > 16) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          ...orientationData,
          deviceId: deviceId.current
        }));
      }
      lastSendTime.current = now;
    }
  };

  const changeModel = (modelId) => {
    setSelectedModel(modelId);
    if ('vibrate' in navigator) navigator.vibrate(50); // Haptic feedback
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'model_change', 
        modelId, 
        deviceId: deviceId.current 
      }));
    }
  };

  const calibrationQuat = useRef(new THREE.Quaternion());

  const calibrate = () => {
    // 1. For Euler path
    setOffsets({
      alpha: rawData.current.alpha,
      beta: rawData.current.beta,
      gamma: rawData.current.gamma
    });
    smoothedData.current = { alpha: 0, beta: 0, gamma: 0, init: true };

    // 2. For Quaternion path
    if (quat) {
      // Capture current quat and invert it to use as a 'Zeroing' factor
      const currentQ = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
      calibrationQuat.current.copy(currentQ).invert();
    }
    
    setStatus('Calibration: Current position is now 0°');
  };

  const sensorRef = useRef(null);

  const stopSensors = () => {
    if (sensorRef.current) {
      sensorRef.current.stop();
      sensorRef.current = null;
    }
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);
    setIsTracking(false);
    setStatus('Sensors Stopped');
  };

  const startSensors = async () => {
    setIsTracking(true);
    // 1. Try Modern AbsoluteOrientationSensor API (most accurate)
    if (window.AbsoluteOrientationSensor) {
      try {
        const perms = await Promise.all([
          navigator.permissions.query({ name: 'accelerometer' }),
          navigator.permissions.query({ name: 'gyroscope' }),
          navigator.permissions.query({ name: 'magnetometer' })
        ]);
        if (perms.every(p => p.state === 'granted' || p.state === 'prompt')) {
          const sensor = new AbsoluteOrientationSensor({ frequency: 60, referenceFrame: 'device' });
          sensorRef.current = sensor;
          sensor.addEventListener('error', (e) => {
            console.warn('AbsoluteOrientationSensor error, falling back:', e.error);
            setupLegacyListeners();
          });
          sensor.addEventListener('reading', () => {
            // sensor.quaternion = [x, y, z, w]
            const [sx, sy, sz, sw] = sensor.quaternion;
            const rawQ = new THREE.Quaternion(sx, sy, sz, sw);
            
            // Apply calibration: calibrated = calibrationInv * raw
            const relativeQ = new THREE.Quaternion().multiplyQuaternions(calibrationQuat.current, rawQ);
            
            const quatPayload = { x: relativeQ.x, y: relativeQ.y, z: relativeQ.z, w: relativeQ.w };
            
            // Calculate Euler angles for the UI readout
            const tempEuler = new THREE.Euler().setFromQuaternion(relativeQ, 'YXZ');
            const a = THREE.MathUtils.radToDeg(tempEuler.y);
            const b = THREE.MathUtils.radToDeg(tempEuler.x);
            const g = THREE.MathUtils.radToDeg(tempEuler.z);

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                quat: quatPayload,
                alpha: a,
                beta: b,
                gamma: g,
                deviceId: deviceId.current
              }));
            }
            
            // Update local preview and readouts
            setQuat(quatPayload);
            setData({
              alpha: a,
              beta: b,
              gamma: g,
              raw: 'Precision Mode: Calibrated'
            });
          });
          sensor.start();
          setStatus('Precision Mode: Active');
          return;
        }
      } catch (e) {
        console.warn('Sensor API failed, falling back:', e);
      }
    }

    // 2. Fallback to legacy
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(state => {
        if (state === 'granted') setupLegacyListeners();
      }).catch(() => setupLegacyListeners());
    } else {
      setupLegacyListeners();
    }
  };

  const setupLegacyListeners = () => {
    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);
    setStatus('Standard Mode: Active');
  };

  useEffect(() => {
    return () => {
      stopSensors();
    };
  }, []);

  return (
    <div className="phone-container">
      <button className="btn back-btn" onClick={onBack}>← Back</button>
      <h1 className="title">Phone Controller</h1>
      
      <div className={`status ${status.includes('Error') || status.includes('Denied') ? 'error' : 'success'}`} style={{ width: '100%' }}>
        Status: <strong>{status}</strong>
      </div>

      <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button 
          className="btn" 
          onClick={isTracking ? stopSensors : startSensors} 
          style={{ flex: 1, minWidth: '140px', backgroundColor: isTracking ? '#ef4444' : '#22c55e' }}
        >
          {isTracking ? 'Stop Sensors' : 'Start Sensors'}
        </button>
        <button className="btn" onClick={calibrate} style={{ flex: 1, minWidth: '140px', backgroundColor: '#3b82f6' }}>
          Reset Heading
        </button>
      </div>

      <div className="data-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{color: '#94a3b8'}}>Alpha</span>
          <span style={{color: '#3b82f6', fontWeight: 'bold'}}>{data.alpha.toFixed(1)}°</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{color: '#94a3b8'}}>Beta</span>
          <span style={{color: '#3b82f6', fontWeight: 'bold'}}>{data.beta.toFixed(1)}°</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{color: '#94a3b8'}}>Gamma</span>
          <span style={{color: '#3b82f6', fontWeight: 'bold'}}>{data.gamma.toFixed(1)}°</span>
        </div>
      </div>

      <div 
        style={{ width: '100%', height: '300px', marginTop: '1rem', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}
      >
        <Canvas camera={{ position: [0, 5, 8], fov: 50 }}>
          <color attach="background" args={['#1e293b']} />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
          <LocalPhoneModel orientation={quat ? null : data} quatOverride={quat} selectedModel={selectedModel} />
          <Environment preset="city" />
        </Canvas>
      </div>
      
      {data.raw && (
        <div style={{marginTop: '1rem', color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace'}}>
          Diagnostic: {data.raw}
        </div>
      )}

      {/* Real-time Model Selector UI */}
      <div style={{ marginTop: '2rem', width: '100%' }}>
        <h3 style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Select Virtual Object</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { id: 'phone', name: 'Smartphone' },
            { id: 'dna', name: 'DNA Helix' },
            { id: 'atom', name: 'Atom Structure' },
            { id: 'hourglass', name: 'Time Glass' },
          ].map(m => (
            <button 
              key={m.id}
              onClick={() => changeModel(m.id)}
              style={{
                padding: '15px',
                borderRadius: '12px',
                border: selectedModel === m.id ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                background: selectedModel === m.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{m.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PhoneController;
