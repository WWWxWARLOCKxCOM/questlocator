const React = require('react');
const { View, Text } = require('react-native');

// Безопасная заглушка карты для веба (ОБЯЗАТЕЛЬНО С ДВУМЯ СЛЭШАМИ)
const MapView = React.forwardRef((props, ref) => ( // <- ОБРАТИ ВНИМАНИЕ НА СТРЕЛКУ =>
  React.createElement(
    View,
    { style: [props.style, { backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' }] },
    React.createElement(Text, { style: { color: '#666', fontWeight: 'bold', textAlign: 'center', padding: 20 } }, 'Карта доступна только в мобильном приложении')
  )
));
MapView.displayName = 'MapView';

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