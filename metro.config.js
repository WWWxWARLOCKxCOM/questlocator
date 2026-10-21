const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Подменяем нативные модули на пустую заглушку при сборке под веб
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Список модулей, которые не работают на вебе
    const unsupportedModules = [
      'react-native-vision-camera',
      'react-native-maps', // Дублируем на всякий случай
    ];

    if (unsupportedModules.includes(moduleName)) {
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