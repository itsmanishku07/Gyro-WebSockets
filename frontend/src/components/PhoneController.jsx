import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';

const LocalPhoneModel = ({ orientation }) => {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current && orientation) {
      const alpha = THREE.MathUtils.degToRad(orientation.alpha);
      const beta = THREE.MathUtils.degToRad(orientation.beta);
      const gamma = THREE.MathUtils.degToRad(orientation.gamma);

      meshRef.current.rotation.set(0, 0, 0);
      meshRef.current.rotation.order = 'YXZ';
      meshRef.current.rotation.y = -alpha;
      meshRef.current.rotation.x = beta;
      meshRef.current.rotation.z = -gamma; 
    }
  });

  return (
    <group ref={meshRef}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[3, 0.4, 6]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.1} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.21, 0]}>
        <boxGeometry args={[2.8, 0.01, 5.8]} />
        <meshStandardMaterial color="#000000" roughness={0.0} metalness={1.0} />
      </mesh>
    </group>
  );
};

const PhoneController = ({ onBack }) => {
  const [status, setStatus] = useState('Idle');
  const [data, setData] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [offsets, setOffsets] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const wsRef = useRef(null);
  const lastSendTime = useRef(0);
  const smoothedData = useRef({ alpha: 0, beta: 0, gamma: 0, init: false });
  const rawData = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const [enabledAxes, setEnabledAxes] = useState({ alpha: true, beta: true, gamma: true });

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
    if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
      // Store raw data for 100% accurate calibration
      rawData.current = { 
        alpha: event.alpha || 0, 
        beta: event.beta || 0, 
        gamma: event.gamma || 0 
      };

      // Apply per-axis offsets
      let a = rawData.current.alpha - offsets.alpha;
      let b = rawData.current.beta - offsets.beta;
      let g = rawData.current.gamma - offsets.gamma;

      // Wrap angles
      const wrap = (val) => {
        while (val < 0) val += 360;
        while (val >= 360) val -= 360;
        return val;
      };
      
      a = wrap(a);
      b = wrap(b);
      g = wrap(g);

      if (!smoothedData.current.init) {
        smoothedData.current = { alpha: a, beta: b, gamma: g, init: true };
      } else {
        const tiltSmooth = 0.15;

        // ALPHA (Compass) - Increased speed (0.1) for better 1:1 "Heading" accuracy
        if (enabledAxes.alpha) {
          const alphaDiff = Math.abs(lerpAngle(smoothedData.current.alpha, a, 1) - smoothedData.current.alpha);
          const alphaSmooth = alphaDiff > 0.2 ? 0.1 : 0; // Lower deadzone, faster response
          smoothedData.current.alpha = wrap(lerpAngle(smoothedData.current.alpha, a, alphaSmooth));
        }
        
        // BETA (Tilt X)
        if (enabledAxes.beta) {
          smoothedData.current.beta = wrap(lerpAngle(smoothedData.current.beta, b, tiltSmooth));
        }

        // GAMMA (Tilt Y)
        if (enabledAxes.gamma) {
          smoothedData.current.gamma = wrap(lerpAngle(smoothedData.current.gamma, g, tiltSmooth));
        }
      }

      const orientationData = {
        alpha: smoothedData.current.alpha,
        beta: smoothedData.current.beta,
        gamma: smoothedData.current.gamma,
        raw: `Ultra-Sync Active`
      };
      sendData(orientationData);
    }
  };

  const handleMotion = (event) => {
    if (event.accelerationIncludingGravity && event.accelerationIncludingGravity.x !== null) {
      const acc = event.accelerationIncludingGravity;
      const b = Math.atan2(-acc.y, acc.z) * (180 / Math.PI);
      const g = Math.atan2(acc.x, Math.sqrt(acc.y*acc.y + acc.z*acc.z)) * (180 / Math.PI);
      
      if (!smoothedData.current.init) {
        smoothedData.current = { alpha: 0, beta: b, gamma: g, init: true };
      } else {
        const smooth = 0.05;
        // Only update if enabled
        if (enabledAxes.beta) {
          smoothedData.current.beta = lerpAngle(smoothedData.current.beta, b, smooth);
        }
        if (enabledAxes.gamma) {
          smoothedData.current.gamma = lerpAngle(smoothedData.current.gamma, g, smooth);
        }
      }

      const orientationData = {
        alpha: smoothedData.current.alpha, // Keep last known alpha
        beta: smoothedData.current.beta,
        gamma: smoothedData.current.gamma,
        raw: `Motion Sync Active`
      };
      sendData(orientationData);
    }
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

  const calibrate = () => {
    // USE RAW DATA for calibration to ensure 100% precision
    setOffsets({
      alpha: rawData.current.alpha,
      beta: rawData.current.beta,
      gamma: rawData.current.gamma
    });
    
    // Force smoothed data to snap to zero instantly
    smoothedData.current = { alpha: 0, beta: 0, gamma: 0, init: true };
    
    setStatus('Precision Reset: All Axes at 0°');
  };
  const [isTracking, setIsTracking] = useState(false);
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
    // 1. Try Modern Sensor API
    if (window.AbsoluteOrientationSensor) {
      try {
        const sensor = new AbsoluteOrientationSensor({ frequency: 60 });
        sensorRef.current = sensor;
        sensor.addEventListener('error', (e) => {
          if (e.error.name === 'NotAllowedError') {
            setupLegacyListeners();
          }
        });
        sensor.addEventListener('reading', () => {
          const q = sensor.quaternion;
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              quat: { x: q[0], y: q[1], z: q[2], w: q[3] },
              deviceId: deviceId.current
            }));
          }
          const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q[0], q[1], q[2], q[3]), 'YXZ');
          setData({
            alpha: THREE.MathUtils.radToDeg(euler.y),
            beta: THREE.MathUtils.radToDeg(euler.x),
            gamma: THREE.MathUtils.radToDeg(euler.z)
          });
        });
        sensor.start();
        setStatus('Precision Mode: Active');
        return;
      } catch (e) {
        console.warn("Sensor API failed, falling back", e);
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
          <LocalPhoneModel orientation={data} />
          <Environment preset="city" />
        </Canvas>
      </div>
      
      {data.raw && (
        <div style={{marginTop: '1rem', color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'monospace'}}>
          Diagnostic: {data.raw}
        </div>
      )}
    </div>
  );
};

export default PhoneController;
