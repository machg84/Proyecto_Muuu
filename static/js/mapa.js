// mapa.js

let map;
const marcadores = {};  // ID → marcador
const rutas = {};       // ID → array de puntos
const polilineas = {};  // ID → polilínea
let puntosArea = [];
let poligono = null;
let poligonoReducido = null;
let marcadoresArea = [];

const colores = ["#FF0000", "#0000FF", "#00FF00", "#FFA500", "#800080", "#00FFFF", "#FFC0CB"];
const coloresPorID = {}; // ID → color asignado

function initMap() {
  const centroPorDefecto = { lat: -33.4263, lng: -70.5728 };

  function inicializarMapa(centro) {
    map = new google.maps.Map(document.getElementById("map"), {
      center: centro,
      zoom: 18,
    });

    setInterval(obtenerUbicaciones, 3000);

    map.addListener("click", (e) => {
      const punto = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      puntosArea.push(punto);

      const marcador = new google.maps.Marker({
        position: punto,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: "#FF0000",
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: "#000000"
        }
      });
      marcadoresArea.push(marcador);

      if (poligono) poligono.setMap(null);
      if (poligonoReducido) poligonoReducido.setMap(null);

      poligono = new google.maps.Polygon({
        paths: puntosArea,
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#FF0000",
        fillOpacity: 0.2
      });
      poligono.setMap(map);

      poligonoReducido = dibujarPoligonoReducido(puntosArea, map);

      enviarAreaAlServidor();
    });

    map.addListener("rightclick", () => {
      limpiarArea();
    });

    document.getElementById("mostrarRutas").addEventListener("change", () => {
      Object.keys(polilineas).forEach(id => {
        if (polilineas[id]) {
          polilineas[id].setMap(document.getElementById("mostrarRutas").checked ? map : null);
        }
      });
    });

    cargarAreaDesdeServidor();
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const centro = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        inicializarMapa(centro);
      },
      () => {
        inicializarMapa(centroPorDefecto);
      }
    );
  } else {
    inicializarMapa(centroPorDefecto);
  }
}

function limpiarArea() {
  if (poligono) {
    poligono.setMap(null);
    poligono = null;
  }
  if (poligonoReducido) {
    poligonoReducido.setMap(null);
    poligonoReducido = null;
  }
  marcadoresArea.forEach(m => m.setMap(null));
  marcadoresArea = [];
  puntosArea = [];
  enviarAreaVaciaAlServidor();
}

function obtenerUbicaciones() {
  fetch("/coordenadas.json")
    .then(response => response.json())
    .then(data => {
      const statusArray = [];
      data.forEach(item => {
        const id = item.id;
        const posicion = { lat: item.lat, lng: item.lng };
        let status = null;

        if (!coloresPorID[id]) {
          coloresPorID[id] = colores[Object.keys(coloresPorID).length % colores.length];
        }

        let iconUrl = "/static/img/vaca.png";
        if (puntosArea.length >= 3 && poligonoReducido) {
          const punto = new google.maps.LatLng(posicion.lat, posicion.lng);
          const poligonoPath = puntosArea.map(p => new google.maps.LatLng(p.lat, p.lng));
          const poligonoGoogle = new google.maps.Polygon({ paths: poligonoPath });

          const reducidoPath = poligonoReducido.getPath().getArray();
          const poligonoReducidoGoogle = new google.maps.Polygon({
            paths: reducidoPath
          });

          if (!google.maps.geometry.poly.containsLocation(punto, poligonoGoogle)) {
            iconUrl = "/static/img/vaca_red.png";
          } else if (!google.maps.geometry.poly.containsLocation(punto, poligonoReducidoGoogle)) {
            iconUrl = "/static/img/vaca_yellow.png";
          } else {
            iconUrl = "/static/img/vaca.png";
          }
        }

        if (puntosArea.length >= 3) {
          const coords = puntosArea.map(p => [p.lng, p.lat]);
          if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
            coords.push(coords[0]);
          }
          const poligonoGeo = turf.polygon([coords]);
          const puntoGeo = turf.point([posicion.lng, posicion.lat]);

          // Calcular la distancia mínima al borde
          let minDist = Infinity;
          for (let i = 0; i < coords.length - 1; i++) {
            const linea = turf.lineString([coords[i], coords[i+1]]);
            const dist = turf.pointToLineDistance(puntoGeo, linea, {units: 'meters'});
            if (dist < minDist) minDist = dist;
          }

          // Verificar si está dentro del polígono
          const dentro = turf.booleanPointInPolygon(puntoGeo, poligonoGeo);
          status = dentro ? Math.round(minDist) : -Math.round(minDist);
        }

        if (marcadores[id]) {
          marcadores[id].setPosition(posicion);
          marcadores[id].setIcon({
            url: iconUrl,
            scaledSize: new google.maps.Size(60, 34),
            anchor: new google.maps.Point(30, 17),
            labelOrigin: new google.maps.Point(30, 42)
          });
        } else {
          marcadores[id] = new google.maps.Marker({
            position: posicion,
            map: map,
            title: `ID: ${id}`,
            label: {
              text: id,
              color: "#000000",
              fontSize: "12px",
              fontWeight: "bold"
            },
            icon: {
              url: iconUrl,
              scaledSize: new google.maps.Size(60, 34),
              anchor: new google.maps.Point(30, 17),
              labelOrigin: new google.maps.Point(30, 42)
            }
          });
        }

        if (!rutas[id]) rutas[id] = [];
        rutas[id].push(posicion);

        if (polilineas[id]) polilineas[id].setMap(null);

        if (document.getElementById("mostrarRutas").checked) {
          polilineas[id] = new google.maps.Polyline({
            path: rutas[id],
            geodesic: true,
            strokeColor: coloresPorID[id],
            strokeOpacity: 1.0,
            strokeWeight: 2,
          });
          polilineas[id].setMap(map);
        } else {
          polilineas[id] = null;
        }

        statusArray.push({ id: id, status: status });
      });

      // Enviar status al backend
      fetch('/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statusArray)
      });
    });
}

function enviarAreaAlServidor() {
  if (puntosArea.length < 3) return;

  const puntosRedondeados = puntosArea.map(p => ({
    lat: Number(p.lat.toFixed(5)),
    lng: Number(p.lng.toFixed(5))
  }));

  fetch('/area.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(puntosRedondeados)
  });
}

function enviarAreaVaciaAlServidor() {
  fetch('/area.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([])
  });
}

function cargarAreaDesdeServidor() {
  fetch('/area.json')
    .then(response => response.json())
    .then(data => {
      if (!Array.isArray(data) || data.length < 3) return;
      puntosArea = data;
      marcadoresArea.forEach(m => m.setMap(null));
      marcadoresArea = [];
      if (poligono) poligono.setMap(null);
      if (poligonoReducido) poligonoReducido.setMap(null);

      puntosArea.forEach(punto => {
        const marcador = new google.maps.Marker({
          position: punto,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: "#FF0000",
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: "#000000"
          }
        });
        marcadoresArea.push(marcador);
      });

      poligono = new google.maps.Polygon({
        paths: puntosArea,
        strokeColor: "#FF0000",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#FF0000",
        fillOpacity: 0.2
      });
      poligono.setMap(map);

      // Dibuja el polígono reducido
      poligonoReducido = dibujarPoligonoReducido(puntosArea, map);
    });
}

function dibujarPoligonoReducido(puntosArea, mapa) {
  if (puntosArea.length < 3) return null;

  // Convertir a GeoJSON
  const coords = puntosArea.map(p => [p.lng, p.lat]);
  // Cerrar el polígono si no está cerrado
  if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
    coords.push(coords[0]);
  }
  const geojson = turf.polygon([coords]);

  // Buffer negativo de 5 metros
  const reducido = turf.buffer(geojson, -5, { units: 'meters' });

  // Obtener los nuevos puntos
  const nuevosPuntos = reducido.geometry.coordinates[0].map(coord => ({lat: coord[1], lng: coord[0]}));

  // Dibujar el polígono reducido
  const poligonoReducido = new google.maps.Polygon({
    paths: nuevosPuntos,
    strokeColor: "#00FF00",   // Verde
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "#00FF00",     // Verde
    fillOpacity: 0.2,
    map: mapa
  });

  return poligonoReducido;
}