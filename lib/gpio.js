let gpio;

try {
    gpio = require('rpi-gpio');
} catch(e) {
    global.warn('Fake GPIO!');
    gpio = { 
        DIR_HIGH: 'high',
        setup: (chan, mode, cb) => { global.muted(`Setup GPIO ${chan} for mode ${mode}`); if (cb) { cb(); } },
        on: () => {},
        destroy: () => {},
        write: (chan, value) => { global.muted(`Set GPIO ${chan} to value ${value}`); }
    }
}

module.exports = gpio;