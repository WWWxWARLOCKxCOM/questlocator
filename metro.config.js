const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Подменяем карты на веб-версию Google Maps
    if (moduleName === 'react-native-maps') {
      return {
        filePath: require.resolve('@teovilla/react-native-web-maps'),
        type: 'sourceFile',
      };
    }
    // Подменяем камеру на безопасную заглушку из папки src
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