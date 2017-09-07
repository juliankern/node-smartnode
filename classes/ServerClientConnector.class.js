const connections = {};

/**
 * Connector for Server-Client connections. This allows to register, evolve,
 * evaluate and add handlers to any received connection.
 *
 * @author  Dennis Sterzenbach <dennis.sterzenbach@gmail.com>
 */
module.exports = class SmartNodeServerClientConnector {
    getConnectionId(connection) {
        return (connection && connection.client && connection.client.id) || '';
    }

    isValidConnection(connection) {
        return connection && (this.getConnectionId(connection) !== '');
    }

    register(connection) {
        if (!this.isValidConnection(connection)) {
            global.log('SmartNodeServerClientConnector: invalid connection');
            return false;
        }

        const id = this.getConnectionId(connection);

        connections[id] = connection;
        global.log('SmartNodeServerClientConnector: register connection', id);

        return id;
    }

    addHandler(connectionId, type, handler) {
        const connection = connections[connectionId];

        if (connection) {
            global.log('SmartNodeServerClientConnector: register handler', connectionId, type);

            connection.on(type, handler);

            return true;
        }

        global.error('SmartNodeServerClientConnector: did not find connection', connectionId);

        return false;
    }

    unregister(connectionId) {
        if (connectionId in connections) {
            global.log('SmartNodeServerClientConnector: unregister connection', connectionId);

            delete connections[connectionId];

            return true;
        }

        return false;
    }
};
