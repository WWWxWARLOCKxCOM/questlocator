const { readFile, writeFile, copyFile } = require('fs').promises;

async function fixReactNativeMapsForWeb() {
  const modulePath = 'node_modules/react-native-maps';
  try {
    // Создаём пустой модуль для веба
    await writeFile(modulePath + '/lib/index.web.js', 'module.exports = {}', 'utf-8');
    
    // Копируем типы (если они есть, чтобы не было ошибки TS)
    try {
      await copyFile(modulePath + '/lib/index.d.ts', modulePath + '/lib/index.web.d.ts');
    } catch (e) {
      // Если файла типов нет — ничего страшного, идём дальше
    }

    const pkg = JSON.parse(await readFile(modulePath + '/package.json', 'utf-8'));
    // Говорим сборщику использовать пустой модуль для веба
    pkg['react-native'] = 'lib/index.js';
    pkg['main'] = 'lib/index.web.js';
    await writeFile(modulePath + '/package.json', JSON.stringify(pkg, null, 2), 'utf-8');
    
    console.log('✅ react-native-maps fixed for web');
  } catch (e) {
    console.log('⚠️ react-native-maps fix skipped:', e.message);
  }
}

fixReactNativeMapsForWeb();