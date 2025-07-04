// mapa.js

let map;
const marcadores = {};  // ID → marcador
const rutas = {};       // ID → array de puntos
const polilineas = {};  // ID → polilínea
let puntosArea = [];
let poligono = null;
let marcadoresArea = [];

const colores = ["#FF0000", "#0000FF", "#00FF00", "#FFA500", "#800080", "#00FFFF", "#FFC0CB"];
const coloresPorID = {}; // ID → color asignado

function initMap() {
  const centro = { lat: -33.4263, lng: -70.5728 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: centro,
    zoom: 19,
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

    poligono = new google.maps.Polygon({
      paths: puntosArea,
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#FF0000",
      fillOpacity: 0.2
    });
    poligono.setMap(map);

    enviarAreaAlServidor();
  });

  map.addListener("rightclick", () => {
    puntosArea = [];
    if (poligono) {
      poligono.setMap(null);
      poligono = null;
    }
    enviarAreaVaciaAlServidor();
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

function limpiarArea() {
  if (poligono) {
    poligono.setMap(null);
    poligono = null;
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
      data.forEach(item => {
        const id = item.id;
        const posicion = { lat: item.lat, lng: item.lng };

        if (!coloresPorID[id]) {
          coloresPorID[id] = colores[Object.keys(coloresPorID).length % colores.length];
        }

        if (marcadores[id]) {
          marcadores[id].setPosition(posicion);
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
              url: "/static/img/vaca.png",
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
    });
}