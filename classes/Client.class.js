// const EventEmitter = require('events');
const bonjour = require('bonjour');
const socketio = require('socket.io-client'); // eslint-disable-line import/no-extraneous-dependencies

const ClientStorage = global.req('classes/Storage.class').Client;
const SmartNodePlugin = global.req('classes/Plugin.class');

module.exports = class SmartNodeClient {
    /**
     * SmartNodeClient contructor
     *
     * @author Julian Kern <mail@juliankern.com>
     */
    constructor(pluginName, cb) {
        this.adapter = {};
        this.socket = {};
        this.service = {};

        this.bonjour = bonjour();
        this.pluginName = pluginName;
        global.log('new SmartNodeClient:', pluginName);
        this.storage = new ClientStorage(this.pluginName, () => {
            if (cb) cb();
        });
    }

    /**
     * init function
     *
     * @author Julian Kern <mail@juliankern.com>
     */
    async init() {
        global.log('Starting search for master server...');

        this.browser = this.bonjour.find({ type: 'smartnode' });

        this.browser.on('up', (service) => {
            this.service = service;

            this.onFoundMaster();
        });
    }

    close() {
        if ('close' in this.socket) this.socket.close();
        this.browser.stop();
        this.bonjour.destroy();
    }

    onFoundMaster() {
        const address = this.service.addresses[0].includes(':') ? this.service.addresses[1] : this.service.addresses[0];

        global.success('Found an SmartNode server:', `http://${address}:${this.service.port}`);

        this.socket = socketio(`http://${address}:${this.service.port}`);

        this.socket.on('connect', this.onConnect.bind(this));
        this.socket.on('unpair', this.onUnpair.bind(this));
        this.socket.on('disconnect', this.onDisconnect.bind(this));
    }

    async onConnect() {
        this.adapter = new (SmartNodePlugin.Client(this))({
            socket: this.socket,
            id: this.socket.id,
        });

        const clientId = await this.adapter.storage.get('clientid');

        global.success(`Connected to server! Own socket: ${this.socket.id}, own client-ID: ${clientId}`);

        const plugin = await this._getPlugin();
        const [pkg, callback] = plugin.init();

        this.socket.emit('connected', {
            plugin: this.pluginName,
            configurationFormat: pkg.configurationFormat,
            displayName: pkg.displayName,
            id: clientId,
        }, async ({ id }) => {
            if (id !== clientId) {
                await this.adapter.storage.set('clientid', id);
            }

            await this.register();
            callback({ id: clientId });
        });
    }

    onUnpair() {
        this.adapter.storage.set('clientid', undefined);
        this.adapter.unpair();
        this._unloadPlugin();
        delete this.adapter;

        this.onFoundMaster();
    }

    async register() {
        const clientId = await this.adapter.storage.get('clientid');
        global.log('emitting register with clientID:', clientId);
        this.socket.emit('register', {
            id: clientId,
        }, (data) => {
            global.muted('Registered successfully!');

            this.adapter.plugin = this.pluginName;

            if (data && data.config && Object.keys(data.config).length) {
                this.adapter.config = data.config;
                this._loadPlugin();
                global.muted('Setup already done, loading plugin...');
            } else {
                this.socket.on('setup', this.onSetup.bind(this));
                global.muted('Waiting for setup to complete...');
            }
        });
    }

    async onSetup(data) {
        global.muted('Setup completed - loading plugin...', data);
        this.adapter.config = data.config;
        this.adapter.room = data.config.room;

        this._loadPlugin();
    }

    async onDisconnect(reason) {
        global.warn('Server disconnected! Reason:', reason);
        this._unloadPlugin();

        global.log('Starting search for master server...');
    }

    async _getPlugin() {
        let plugin;

        try {
            // eslint-disable-next-line global-require, import/no-dynamic-require
            plugin = await require(`${this.pluginName}`)
                .Client(this.adapter)
                .catch((e) => { global.error('Client load plugin error', e); });
        } catch (e) {
            global.error(`Could not load plugin "${this.pluginName}"
                - you probably need to install it via "npm install ${this.pluginName}" first!`);
            global.muted('Debug', e);
            process.exit(1);
        }

        let functionError;
        if (!('init' in plugin)) { functionError = 'init'; }
        if (!('load' in plugin)) { functionError = 'load'; }
        if (!('unload' in plugin)) { functionError = 'unload'; }
        if (!('unpair' in plugin)) { functionError = 'unpair'; }

        if (functionError) {
            throw global.error(`Plugin "${this.pluginName}" does not provide a "${functionError}()"
                -function on the client side. Please contact the author!`);
        }

        return plugin;
    }

    /**
     * load client plugin
     *
     * @author Julian Kern <mail@juliankern.com>
     *
     * @return {[type]} returns true if loaded
     */
    async _loadPlugin() {
        const plugin = await this._getPlugin();
        this.adapter.unload = plugin.unload;
        this.adapter.unpair = plugin.unpair;

        return plugin.load().then((loaded) => {
            if (loaded) this.adapter.loaded = true;
        });
    }

    /**
     * unloads plugin and cleans up
     *
     * @author Julian Kern <mail@juliankern.com>
     */
    async _unloadPlugin() {
        if (this.adapter.loaded) this.adapter.unload();
        this.adapter.loaded = false;
        this.adapter.socket.close();
    }
};
