const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Подменяем карты на нашу безопасную заглушку
    if (moduleName === 'react-native-maps') {
      return {
        filePath: path.resolve(__dirname, 'src/mocks/mock-maps.js'),
        type: 'sourceFile',
      };
    }
    // Камеру оставляем заглушкой
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