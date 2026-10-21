const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Возвращаем веб-версию карт
    if (moduleName === 'react-native-maps') {
      return {
        filePath: require.resolve('@teovilla/react-native-web-maps'),
        type: 'sourceFile',
      };
    }
    // Камеру оставляем заглушкой (ей все равно нечего делать в браузере)
    if (moduleName === 'react-native-vision-camera') {
      return {
        filePath: path.resolve(__dirname, 'src/mocks/mock-camera.js'),
        type: 'sourceFile',
      };
    }
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;