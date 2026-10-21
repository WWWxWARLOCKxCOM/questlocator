const React = require('react');
const { View } = require('react-native');
const { GoogleMap, LoadScript, Marker: GoogleMarker } = require('@react-google-maps/api');
const Constants = require('expo-constants');

// Обертка для карты
const MapView = React.forwardRef((props, ref) => {
  const apiKey = Constants.expoConfig?.extra?.GOOGLE_MAPS_WEB_API_KEY || '';
  
  // Центрируем карту по initialRegion
  const center = props.initialRegion 
    ? { lat: props.initialRegion.latitude, lng: props.initialRegion.longitude } 
    : { lat: 55.751244, lng: 37.618423 };

  const markers = [];

  // Магия: мы читаем элементы <Marker>, которые ты передаешь в MapView в своих экранах
  React.Children.forEach(props.children, (child) => {
    if (child && child.props && child.props.coordinate) {
      const { latitude, longitude } = child.props.coordinate;
      markers.push(
        React.createElement(GoogleMarker, {
          key: child.key,
          position: { lat: latitude, lng: longitude },
          // Прокидываем клик (например, для открытия карточки заведения)
          onClick: child.props.onPress
        })
      );
    }
  });

  return React.createElement(
    View,
    { style: props.style },
    React.createElement(
      LoadScript,
      { googleMapsApiKey: apiKey },
      React.createElement(
        GoogleMap,
        { 
          mapContainerStyle: { width: '100%', height: '100%' }, 
          center, 
          zoom: 14,
          options: { disableDefaultUI: true } // Убираем лишние кнопки Google для чистоты
        },
        ...markers
      )
    )
  );
});

// Создаем пустые заглушки, чтобы экраны не падали
const Marker = () => null;
const Circle = () => null;

module.exports = {
  __esModule: true,
  default: MapView,
  Marker: Marker,
  Circle: Circle,
  PROVIDER_GOOGLE: 'google',
};