const React = require('react');
const { View, Text } = require('react-native');

const Camera = React.forwardRef((props, ref) => (
  React.createElement(View, { style: [{ backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, props.style] },
    React.createElement(Text, { style: { color: '#fff' } }, 'Камера недоступна в браузере'))
));
Camera.displayName = 'Camera';

Camera.requestCameraPermission = async () => 'granted';
Camera.getCameraPermissionStatus = () => 'granted';

module.exports = {
  __esModule: true,
  Camera: Camera,
  useCameraDevice: () => null,
  useCodeScanner: () => ({ codeTypes: ['qr'], onCodeScanned: () => {} }),
  useCameraPermission: () => ({ hasPermission: true, requestPermission: async () => true }),
};