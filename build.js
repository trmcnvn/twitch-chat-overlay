const JSZip = require('node-zip');
const fs = require('fs');

const FILES = [
  'manifest.json',
  'main.js',
  'overlay.js',
  'style.css',
  'resources/icon-16.jpg',
  'resources/icon-48.jpg',
  'resources/icon-96.jpg',
  'resources/icon-128.jpg'
];

function run() {
  try {
    console.log('🔥 starting build...');
    if (!fs.existsSync('build')) {
      fs.mkdirSync('build');
    }
    const zip = new JSZip();
    for (const file of FILES) {
      zip.file(file, fs.readFileSync(file));
    }
    const data = zip.generate({ type: 'nodebuffer' });
    fs.writeFileSync('build/twitch-chat-overlay.zip', data);
    console.log('🚀 build finished');
  } catch (error) {
    console.error(error.message);
  }
}

run();
