/**
 * Веб-полифилл react-native-maps на @react-google-maps/api.
 * Поддерживает:
 *  - интерактивную карту (pan, zoom, drag)
 *  - <Marker> с pinColor / draggable / onPress
 *  - <Marker> с кастомными React-детьми (через OverlayView)
 *  - <Circle>
 *  - MapView.ref.animateToRegion(...)
 *  - onPress, onLongPress, onRegionChangeComplete
 *  - showsUserLocation (рисует точку по navigator.geolocation)
 */
const React = require('react');
const { View } = require('react-native');
const Constants = require('expo-constants');

const gmaps = require('@react-google-maps/api');
const {
  GoogleMap,
  LoadScript,
  Marker: GoogleMarker,
  Circle: GoogleCircle,
} = gmaps;
// OverlayView в разных версиях API называется по-разному
const OverlayViewComp = gmaps.OverlayViewF || gmaps.OverlayView;
const OverlayViewPane =
  (gmaps.OverlayView && gmaps.OverlayView.OVERLAY_MOUSE_TARGET) ||
  'overlayMouseTarget';

// ─── Marker / Circle — маркеры-«типы», которые MapView распознаёт ───
function Marker() { return null; }
function Circle() { return null; }

function latDeltaToZoom(latDelta) {
  if (!latDelta || latDelta <= 0) return 13;
  const z = Math.round(Math.log2(360 / latDelta));
  return Math.max(1, Math.min(21, z));
}

function toLatLng(coord) {
  return { lat: coord.latitude, lng: coord.longitude };
}

const MapView = React.forwardRef(function MapView(props, ref) {
  const apiKey =
    Constants.expoConfig?.extra?.GOOGLE_MAPS_WEB_API_KEY ||
    Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY ||
    '';

  const mapRef = React.useRef(null);
  const longPressTimerRef = React.useRef(null);
  const lastCoordRef = React.useRef(null);
  const onLongPressRef = React.useRef(props.onLongPress);
  const onRegionChangeCompleteRef = React.useRef(props.onRegionChangeComplete);
  const onPressRef = React.useRef(props.onPress);

  React.useEffect(() => { onLongPressRef.current = props.onLongPress; }, [props.onLongPress]);
  React.useEffect(() => { onRegionChangeCompleteRef.current = props.onRegionChangeComplete; }, [props.onRegionChangeComplete]);
  React.useEffect(() => { onPressRef.current = props.onPress; }, [props.onPress]);

  const initialRegion = props.initialRegion || {
    latitude: 55.751244,
    longitude: 37.618423,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };
  const [region, setRegion] = React.useState(initialRegion);
  const [userPos, setUserPos] = React.useState(null);

  // React Native Maps ref API
  React.useImperativeHandle(ref, () => ({
    animateToRegion(r, duration = 400) {
      setRegion(r);
      const map = mapRef.current;
      if (!map) return;
      map.panTo({ lat: r.latitude, lng: r.longitude });
      map.setZoom(latDeltaToZoom(r.latitudeDelta));
    },
    animateCamera(cam) {
      if (cam && cam.center) {
        setRegion((prev) => ({
          ...prev,
          latitude: cam.center.latitude,
          longitude: cam.center.longitude,
          latitudeDelta: cam.zoom ? prev.latitudeDelta : prev.latitudeDelta,
        }));
        const map = mapRef.current;
        if (map) {
          map.panTo({ lat: cam.center.latitude, lng: cam.center.longitude });
          if (cam.zoom) map.setZoom(Math.round(cam.zoom));
        }
      }
    },
    getCamera() {
      return Promise.resolve({ center: region, zoom: latDeltaToZoom(region.latitudeDelta) });
    },
    fitToCoordinates() { /* no-op */ },
    fitToSuppliedMarkers() { /* no-op */ },
    animateToCoordinate(coord) {
      this.animateToRegion({
        latitude: coord.latitude, longitude: coord.longitude,
        latitudeDelta: region.latitudeDelta, longitudeDelta: region.longitudeDelta,
      });
    },
  }));

  // User location через браузер
  React.useEffect(() => {
    if (!props.showsUserLocation) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    let watchId = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    } catch { /* no-op */ }
    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [props.showsUserLocation]);

  // Разбираем детей на marker/circle (включая фрагменты)
  const { markers, circles } = React.useMemo(() => {
    const m = [];
    const c = [];
    const walk = (children) => {
      React.Children.forEach(children, (child) => {
        if (!React.isValidElement(child)) return;
        if (child.type === Marker) { m.push(child); return; }
        if (child.type === Circle) { c.push(child); return; }
        if (child.type === React.Fragment) { walk(child.props.children); }
      });
    };
    walk(props.children);
    return { markers: m, circles: c };
  }, [props.children]);

  const handleLoad = React.useCallback((map) => {
    mapRef.current = map;
    // Long-press: 500 мс между mousedown и mouseup
    map.addListener('mousedown', (e) => {
      if (!onLongPressRef.current || !e.latLng) return;
      lastCoordRef.current = {
        latitude: e.latLng.lat(),
        longitude: e.latLng.lng(),
      };
      longPressTimerRef.current = setTimeout(() => {
        const coord = lastCoordRef.current;
        if (coord && onLongPressRef.current) {
          onLongPressRef.current({ nativeEvent: { coordinate: coord } });
        }
        longPressTimerRef.current = null;
      }, 500);
    });
    const clearTimer = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      lastCoordRef.current = null;
    };
    map.addListener('mouseup', clearTimer);
    map.addListener('dragstart', clearTimer);
  }, []);

  const handleClick = React.useCallback((e) => {
    if (!onPressRef.current) return;
    if (!e.latLng) { onPressRef.current({ nativeEvent: {} }); return; }
    onPressRef.current({
      nativeEvent: {
        coordinate: { latitude: e.latLng.lat(), longitude: e.latLng.lng() },
      },
    });
  }, []);

  const handleIdle = React.useCallback(() => {
    const map = mapRef.current;
    if (!map || !onRegionChangeCompleteRef.current) return;
    const c = map.getCenter();
    const zoom = map.getZoom();
    const latDelta = 360 / Math.pow(2, zoom);
    onRegionChangeCompleteRef.current({
      latitude: c.lat(),
      longitude: c.lng(),
      latitudeDelta: latDelta,
      longitudeDelta: latDelta,
    });
  }, []);

  const center = React.useMemo(
    () => ({ lat: region.latitude, lng: region.longitude }),
    [region.latitude, region.longitude],
  );
  const zoom = React.useMemo(
    () => latDeltaToZoom(region.latitudeDelta),
    [region.latitudeDelta],
  );

  const renderMarkerChild = (m, i) => {
    const { coordinate, pinColor, onPress, draggable, onDragEnd } = m.props;
    const key = m.key || `mk-${i}`;
    const hasChildren = React.Children.count(m.props.children) > 0;
    const pos = toLatLng(coordinate);

    const icon = pinColor
      ? {
          path: 'M12 0C7.03 0 3 4.03 3 9c0 5.25 9 15 9 15s9-9.75 9-15c0-4.97-4.03-9-9-9zm0 13c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z',
          fillColor: pinColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 1,
          scale: 1.5,
          anchor: { x: 12, y: 24 },
        }
      : undefined;

    const common = {
      key,
      position: pos,
      onClick: onPress,
      draggable: !!draggable,
      onDragEnd: (e) => {
        if (!onDragEnd || !e.latLng) return;
        onDragEnd({
          nativeEvent: {
            coordinate: { latitude: e.latLng.lat(), longitude: e.latLng.lng() },
          },
        });
      },
      icon,
    };

    // Если у маркера есть React-дети — рендерим через OverlayView,
    // чтобы сохранить кастомный HTML-вид (bubble, label и т.д.)
    if (hasChildren && OverlayViewComp) {
      return React.createElement(
        OverlayViewComp,
        { key, position: pos, mapPaneName: OverlayViewPane },
        React.createElement(View, { onClick: onPress }, m.props.children),
      );
    }
    return React.createElement(GoogleMarker, common);
  };

  return React.createElement(
    View,
    { style: props.style },
    React.createElement(
      LoadScript,
      { googleMapsApiKey: apiKey, libraries: [] },
      React.createElement(
        GoogleMap,
        {
          mapContainerStyle: { width: '100%', height: '100%' },
          center,
          zoom,
          onLoad: handleLoad,
          onClick: handleClick,
          onIdle: handleIdle,
          options: {
            disableDefaultUI: true,
            gestureHandling: 'greedy',
            clickableIcons: false,
          },
        },
        ...circles.map((c, i) =>
          React.createElement(GoogleCircle, {
            key: c.key || `circ-${i}`,
            center: toLatLng(c.props.center),
            radius: c.props.radius || 50,
            options: {
              strokeColor: c.props.strokeColor,
              fillColor: c.props.fillColor,
              strokeOpacity: c.props.strokeOpacity ?? 1,
              fillOpacity: c.props.fillOpacity ?? 1,
              strokeWeight: c.props.strokeWidth ?? 2,
            },
          }),
        ),
        ...markers.map(renderMarkerChild),
        // Пользовательская геолокация
        userPos
          ? React.createElement(GoogleMarker, {
              key: '__user__',
              position: userPos,
              icon: {
                path: 'M 0,-1 0,1 1,0 z', // упрощённая точка
                scale: 6,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
            })
          : null,
      ),
    ),
  );
});

module.exports = {
  __esModule: true,
  default: MapView,
  Marker,
  Circle,
  PROVIDER_GOOGLE: 'google',
  PROVIDER_DEFAULT: 'google',
};