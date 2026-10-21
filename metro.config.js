const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // 1. Подменяем react-native-maps на веб-версию для Google Maps
    if (moduleName === 'react-native-maps') {
      return {
        filePath: require.resolve('@teovilla/react-native-web-maps'),
        type: 'sourceFile',
      };
    }
    
    // 2. Камеру подменяем на пустую заглушку (сканер сделаем через .web.tsx)
    if (moduleName === 'react-native-vision-camera') {
      return {
        filePath: path.resolve(__dirname, 'empty-module.js'),
        type: 'sourceFile',
      };
    }
  }
  
  // Для всех остальных случаев используем стандартное разрешение
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;