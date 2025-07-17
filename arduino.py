import serial
import json
import re
import requests
import time
import re

regex_emisor = re.compile(r"^E\d+$")
URL = 'https://proyecto-muuu.fly.dev' #'http://127.0.0.1:8080'


# Configuración
PUERTO = '/dev/tty.usbserial-A5069RR4'
BAUDIOS = 9600
URL_GET = f'{URL}/coordenadas.json'
URL_POST = f'{URL}/actualizar'
URL_STATUS = f'{URL}/status.json'

arduino = serial.Serial(PUERTO, BAUDIOS, timeout=1)

# Mapeo de alias
alias = {
    "E1": "Luna",
    "E2": "Rulo"
}

ultimo_status = None
ultimo_envio_status = 0
INTERVALO_STATUS = 2  # segundos

def enviar_status_si_cambio():
    global ultimo_status, ultimo_envio_status
    ahora = time.time()
    if ahora - ultimo_envio_status >= INTERVALO_STATUS:
        try:
            response = requests.get(URL_STATUS)
            response.raise_for_status()
            status = response.json()
            # Filtrar solo los registros con status numérico y <= 5
            status_filtrado = [
                item for item in status
                if isinstance(item.get("status"), (int, float)) #and item["status"] <= 5
            ]
            # Formatear como E1|status (usando alias inverso)
            ultimo_status_dict = {item["id"]: item["status"] for item in ultimo_status} if ultimo_status else {}
            alias_inverso = {v: k for k, v in alias.items()}
            lineas = []
            for item in status_filtrado:
                id_arduino = alias_inverso.get(item["id"], item["id"])
                # Solo enviar si el status cambió o es nuevo
                if ultimo_status_dict.get(item["id"]) != item["status"]:
                    lineas.append(f"{id_arduino}|{item['status']}")
            mensaje = "\n".join(lineas) + ("\n" if lineas else "")
            if lineas:
                print("Status cambiado detectado, enviando al Arduino...")
                print("Mensaje enviado:", mensaje.strip())
                arduino.write(mensaje.encode("utf-8"))
            ultimo_status = status_filtrado
            ultimo_envio_status = ahora
        except Exception as e:
            print("⚠️ Error al verificar status:", e)

print("Esperando coordenadas desde Arduino...")

while True:
    enviar_status_si_cambio()
    try:
        linea = arduino.readline().decode("utf-8", errors="ignore").strip()
        print("Recibido:", linea)

        partes = linea.split("|")
        if len(partes) != 3:
            continue

        raw_id = partes[0].strip()
        if not regex_emisor.match(raw_id):
            # Solo mostrar el mensaje si la línea no es un ACK
            if not raw_id.startswith("ACK"):
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