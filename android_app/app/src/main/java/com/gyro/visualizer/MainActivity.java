package com.gyro.visualizer;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONObject;

import java.net.URI;
import java.util.UUID;

public class MainActivity extends AppCompatActivity implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor rotationVectorSensor;
    private WebSocketClient webSocketClient;
    private String deviceId = UUID.randomUUID().toString().substring(0, 8);

    private TextView textStatus, valAlpha, valBeta, valGamma;
    private EditText editIp;
    private Button btnConnect;

    private float[] rotationMatrix = new float[9];
    private float[] orientationValues = new float[3];
    private long lastSendTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        textStatus = findViewById(R.id.textStatus);
        valAlpha = findViewById(R.id.valAlpha);
        valBeta = findViewById(R.id.valBeta);
        valGamma = findViewById(R.id.valGamma);
        editIp = findViewById(R.id.editIp);
        btnConnect = findViewById(R.id.btnConnect);

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        rotationVectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);

        btnConnect.setOnClickListener(v -> connectToWebSocket());
    }

    private void connectToWebSocket() {
        String ip = editIp.getText().toString();
        String url = "ws://" + ip + ":8000/ws";

        if (webSocketClient != null) {
            webSocketClient.close();
        }

        try {
            webSocketClient = new WebSocketClient(new URI(url)) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    runOnUiThread(() -> {
                        textStatus.setText("Status: Connected to " + ip);
                        textStatus.setTextColor(0xFF22c55e);
                        btnConnect.setText("Disconnect");
                    });
                }

                @Override
                public void onMessage(String message) {}

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    runOnUiThread(() -> {
                        textStatus.setText("Status: Disconnected");
                        textStatus.setTextColor(0xFFef4444);
                        btnConnect.setText("Connect to PC");
                    });
                }

                @Override
                public void onError(Exception ex) {
                    runOnUiThread(() -> textStatus.setText("Error: " + ex.getMessage()));
                }
            };
            webSocketClient.connect();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_ROTATION_VECTOR) {
            // Convert rotation vector to rotation matrix
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);
            // Convert rotation matrix to orientation angles (azimuth, pitch, roll)
            SensorManager.getOrientation(rotationMatrix, orientationValues);

            // Convert to degrees
            float azimuth = (float) Math.toDegrees(orientationValues[0]); // Alpha (Heading)
            float pitch = (float) Math.toDegrees(orientationValues[1]);   // Beta (X-axis)
            float roll = (float) Math.toDegrees(orientationValues[2]);    // Gamma (Y-axis)

            // Normalize Alpha to 0-360
            if (azimuth < 0) azimuth += 360;

            // Update UI
            valAlpha.setText(String.format("%.2f°", azimuth));
            valBeta.setText(String.format("%.2f°", pitch));
            valGamma.setText(String.format("%.2f°", roll));

            // Send to WebSocket (Throttle to ~60fps)
            long now = System.currentTimeMillis();
            if (now - lastSendTime > 16 && webSocketClient != null && webSocketClient.isOpen()) {
                try {
                    JSONObject json = new JSONObject();
                    json.put("alpha", azimuth);
                    json.put("beta", pitch);
                    json.put("gamma", roll);
                    json.put("deviceId", deviceId);
                    json.put("raw", "Native Android API");
                    webSocketClient.send(json.toString());
                } catch (Exception e) {
                    e.printStackTrace();
                }
                lastSendTime = now;
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    protected void onResume() {
        super.onResume();
        if (rotationVectorSensor != null) {
            sensorManager.registerListener(this, rotationVectorSensor, SensorManager.SENSOR_DELAY_GAME);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        sensorManager.unregisterListener(this);
    }
}
