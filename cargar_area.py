import serial
import json
import requests
import re
import time


URL='https://proyecto-muuu.fly.dev'
PUERTO = '/dev/cu.usbserial-A5069RR4'
BAUDIOS = 9600
URL_POLIGONO = f'{URL}/area.json'
MAX_PUNTOS = 20

# Variables para control de actualización de polígono
ultimo_poligono = None
ultimo_envio = 0
INTERVALO_SEGUNDOS = 30

def enviar_poligono_si_cambio():
    global ultimo_poligono, ultimo_envio
    ahora = time.time()

    if ahora - ultimo_envio >= INTERVALO_SEGUNDOS:
        try:
            response = requests.get(URL_POLIGONO)
            response.raise_for_status()
            poligono = response.json()

            if not isinstance(poligono, list) or len(poligono) > MAX_PUNTOS:
                return

            if poligono != ultimo_poligono:
                print("🔄 Polígono nuevo detectado, enviando al Arduino...")
                json_str = json.dumps(poligono)
                arduino.write((json_str + "\n").encode("utf-8"))
                ultimo_poligono = poligono
                print("✅ Polígono actualizado")
            #else:
            #    print("Enviado: Sin cambios en el polígono")

            ultimo_envio = ahora

        except Exception as e:
            print("⚠️ Error al verificar polígono:", e)


# --- Lógica original del script para recibir coordenadas del Arduino ---
regex_emisor = re.compile(r"^E\d+$")

URL_GET = f'{URL}/coordenadas.json'
URL_POST = f'{URL}/actualizar'

arduino = serial.Serial(PUERTO, BAUDIOS, timeout=1)

# Mapeo de alias
alias = {
    "E1": "Luna",
    "E2": "Rulo"
}

print("Esperando coordenadas desde Arduino...")

while True:
    enviar_poligono_si_cambio()

    try:
        linea = arduino.readline().decode("utf-8", errors="ignore").strip()
        print("Recibido:", linea)

        partes = linea.split("|")
        if len(partes) != 4:
            continue

        raw_id = partes[0].strip()
        if not regex_emisor.match(raw_id):
            print(f"ID inválido: '{raw_id}' → no cumple con el formato 'E#'")
            continue

        animal_id = alias.get(raw_id, raw_id)
        lat = float(partes[1].strip())
        lon = float(partes[2].strip())

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