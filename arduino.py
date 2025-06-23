import serial
import json
import re
import requests
import time
import re

regex_emisor = re.compile(r"^Emisor_\d+$")

# Configuración
PUERTO = '/dev/tty.usbserial-A5069RR4'
BAUDIOS = 9600
URL_GET = 'https://proyecto-muuu.fly.dev/coordenadas.json'
URL_POST = 'https://proyecto-muuu.fly.dev/actualizar'

arduino = serial.Serial(PUERTO, BAUDIOS, timeout=1)

# Mapeo de alias
alias = {
    "Emisor_1": "Luna",
    "Emisor_2": "Rulo"
}

print("Esperando coordenadas desde Arduino...")

while True:
    try:
        linea = arduino.readline().decode("utf-8", errors="ignore").strip()
        print("Recibido:", linea)

        # Remover prefijo tipo "Mensaje #4:"
        if ':' in linea:
            _, datos = linea.split(":", 1)
            datos = datos.strip()
        else:
            #print("Formato no válido (falta ':')")
            continue

        partes = datos.split(",")
        if len(partes) != 4:
            print("Formato no válido")
            continue

        raw_id = partes[0].strip()
        if not regex_emisor.match(raw_id):
            print(f"ID inválido: '{raw_id}' → no cumple con el formato 'Emisor_#'")
            continue

        animal_id = alias.get(raw_id, raw_id)
        lat = float(partes[2].strip())
        lon = float(partes[3].strip())

        print(f"Extraído → ID: {animal_id}, Lat: {lat}, Lon: {lon}")

        # Obtener coordenadas actuales
        try:
            response = requests.get(URL_GET)
            coordenadas = response.json()
        except Exception as e:
            print("Error al obtener coordenadas:", e)
            coordenadas = []

        # Actualizar o agregar
        actualizado = False
        for item in coordenadas:
            if item['id'] == animal_id:
                item['lat'] = lat
                item['lng'] = lon
                actualizado = True
                break
        if not actualizado:
            coordenadas.append({"id": animal_id, "lat": lat, "lng": lon})

        # Enviar al servidor
        response = requests.post(URL_POST, json=coordenadas)
        if response.status_code == 200:
            print("Ubicación enviada correctamente.")
        else:
            print("Error al enviar coordenadas:", response.status_code, response.text)

        time.sleep(3)

    except KeyboardInterrupt:
        print("\nFinalizado por el usuario.")
        break
    except Exception as e:
        print("Error:", e)