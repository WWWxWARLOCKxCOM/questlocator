const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Подменяем только карту
    if (moduleName === 'react-native-maps') {
      return {
        filePath: require.resolve('@teovilla/react-native-web-maps'),
        type: 'sourceFile',
      };
    }
  }
  
  // Для всех остальных модулей (включая камеру) используем стандартное разрешение.
  // Благодаря файлам .web.tsx, камера не попадет в веб-сборку.
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;