import serial
import json
import re
import requests
import time

# Configura esto según tu puerto y velocidad
PUERTO = '/dev/tty.usbserial-A5069RR4'
BAUDIOS = 9600
URL_API = 'https://proyecto-muuu-1.fly.dev/actualizar'  # Reemplaza con tu URL real

arduino = serial.Serial(PUERTO, BAUDIOS, timeout=1)

# Expresión regular para extraer latitud y longitud
patron = re.compile(r"Lat:\s*(-?\d+\.\d+),\s*Lon:\s*(-?\d+\.\d+)")

print("Esperando coordenadas desde Arduino...")

while True:
    try:
        linea = arduino.readline().decode("utf-8", errors="ignore").strip()
        print("Recibido:", linea)

        match = patron.search(linea)
        if match:
            lat = float(match.group(1))
            lon = float(match.group(2))
            print(f"Extraído: {lat}, {lon}")

            data = {"lat": lat, "lng": lon}
            response = requests.post(URL_API, json=data)

            if response.status_code == 200:
                print("Coordenadas enviadas correctamente.")
            else:
                print(f"Error al enviar: {response.status_code} - {response.text}")

            time.sleep(3)  # Espera entre envíos

    except KeyboardInterrupt:
        print("\nFinalizado por el usuario.")
        break
    except Exception as e:
        print("Error:", e)