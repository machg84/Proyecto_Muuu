from flask import Flask, send_from_directory, jsonify, request
import json
import os

app = Flask(__name__, static_folder='static')
COORDS_FILE = os.path.join('static', 'coordenadas.json')

def leer_coordenadas():
    if not os.path.exists(COORDS_FILE):
        return []
    with open(COORDS_FILE) as f:
        return json.load(f)

def escribir_coordenadas(data):
    with open(COORDS_FILE, 'w') as f:
        json.dump(data, f)

@app.route('/')
def home():
    return send_from_directory('static', 'index.html')

@app.route('/coordenadas.json')
def coordenadas():
    return jsonify(leer_coordenadas())

@app.route('/actualizar', methods=['POST'])
def actualizar():
    data = request.get_json()

    # Validar que sea una lista de objetos con id, lat, lng
    if not isinstance(data, list):
        return jsonify({'error': 'Se esperaba una lista de coordenadas'}), 400

    for item in data:
        if not all(k in item for k in ['id', 'lat', 'lng']):
            return jsonify({'error': f'Falta id/lat/lng en uno de los elementos: {item}'}), 400

    with open('static/coordenadas.json', 'w') as f:
        json.dump(data, f)

    return jsonify({'status': 'ok'}), 200

@app.route('/area.json')
def obtener_area():
    try:
        with open('static/area.json') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': 'No se pudo cargar el área', 'detalle': str(e)}), 500

@app.route('/area.json', methods=['POST'])
def actualizar_area():
    data = request.get_json()

    if not isinstance(data, list):
        return jsonify({'error': 'Se esperaba una lista de coordenadas'}), 400

    for punto in data:
        if not all(k in punto for k in ['lat', 'lng']):
            return jsonify({'error': f'Formato inválido: {punto}'}), 400

    try:
        with open('static/area.json', 'w') as f:
            json.dump(data, f)
        return jsonify({'status': 'Área guardada correctamente'}), 200
    except Exception as e:
        return jsonify({'error': 'No se pudo guardar el área', 'detalle': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)