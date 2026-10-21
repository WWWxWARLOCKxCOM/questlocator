const React = require('react');
const { View, Text } = require('react-native');

// Компонент-заглушка, который на вебе будет подгружать настоящую карту
const MapView = React.forwardRef((props, ref) => {
  const { GoogleMap, LoadScript, Marker } = require('@react-google-maps/api');
  const apiKey = require('expo-constants').expoConfig?.extra?.GOOGLE_MAPS_WEB_API_KEY || '';

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
  };

  const defaultCenter = { lat: 55.751244, lng: 37.618423 };

  return React.createElement(
    LoadScript,
    { googleMapsApiKey: apiKey },
    React.createElement(
      GoogleMap,
      {
        mapContainerStyle,
        center: defaultCenter,
        zoom: 14,
      },
      // Пробрасываем маркеры, если они есть
      React.Children.map(props.children, (child) => {
        if (React.isValidElement(child) && child.type === Marker) {
          return child;
        }
        return null;
      })
    )
  );
});

// Заглушки для всего остального, чтобы не было ошибок
const Dummy = () => null;
Dummy.displayName = 'Dummy';

module.exports = {
  __esModule: true,
  default: MapView,
  Marker: Dummy,
  Circle: Dummy,
  Polyline: Dummy,
  Polygon: Dummy,
  PROVIDER_GOOGLE: 'google',
  PROVIDER_DEFAULT: 'default',
};