const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Полноценный Google-Maps полифилл для react-native-maps.
    // Веб-версия теперь интерактивна: pan/zoom/клики/маркеры/круги/animateToRegion.
    if (moduleName === 'react-native-maps') {
      return {
        filePath: path.resolve(__dirname, 'src/mocks/mock-maps.js'),
        type: 'sourceFile',
      };
    }
    // Камера оставляем заглушкой
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