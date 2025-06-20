from flask import Flask, send_from_directory, jsonify, request
import json
import os

app = Flask(__name__, static_folder='static')

# Ruta principal: entrega el HTML
@app.route('/')
def home():
    return send_from_directory('static', 'index.html')

# Ruta para obtener coordenadas
@app.route('/coordenadas.json')
def coordenadas():
    with open('static/coordenadas.json') as f:
        data = json.load(f)
    return jsonify(data)

# Ruta para actualizar coordenadas (requiere JSON con "lat" y "lng")
@app.route('/actualizar', methods=['POST'])
def actualizar():
    data = request.get_json()
    if not data or 'lat' not in data or 'lng' not in data:
        return jsonify({'error': 'Faltan lat o lng'}), 400

    with open('static/coordenadas.json', 'w') as f:
        json.dump({'lat': data['lat'], 'lng': data['lng']}, f)

    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)