const Consul = require('consul');
const crypto = require('crypto');
const async  = require('async');

let ConsulService = function(options, node) {
    this.consul = new Consul({
        host: options.host,
        port: options.port
    })

    this.node       = node;
    this.deregister = options.deregister || "60s";
    this.interval   = options.interval || "15s";
    this.insightAddr = options.nodeIp;
    this.insightPort = options.port;
    this.fullnodeHost = options.nodeIp;
    this.fullnodeRpcPort = parseInt(options.rpcPort);
    this.fullnodeSocketPort = parseInt(options.socketPort);

    this.services = [{
        name      : 'sv_insight_' + options.coin.toLowerCase(),
        address   : insightAddr,
        port      : insightPort,
        id        : crypto.createHash('md5').update(`sv_insight_${options.coin.toLowerCase()}:${insightAddr}:${insightPort}`).digest("hex"),
        check     : {
            http    : `http://${insightAddr}:${insightPort}/healthcheck`,
            interval: interval,
            deregister_critical_service_after: deregister
        }
    }, {
        name      : 'sv_fullnode_rpc_' + options.coin.toLowerCase(),
        address   : fullnodeHost,
        port      : fullnodeRpcPort,
        id        : crypto.createHash('md5').update(`sv_fullnode_rpc_${options.coin.toLowerCase()}:${fullnodeHost}:${fullnodeRpcPort}`).digest("hex"),
        check     : {
            tcp     : `${fullnodeHost}:${fullnodeRpcPort}`,
            interval: interval,
            deregister_critical_service_after: deregister
        }
    }, {
        name      : 'sv_fullnode_socket_' + options.coin.toLowerCase(),
        address   : fullnodeHost,
        port      : fullnodeSocketPort,
        id        : crypto.createHash('md5').update(`sv_fullnode_socket_${options.coin.toLowerCase()}:${fullnodeHost}:${fullnodeSocketPort}`).digest("hex"),
        check     : {
            tcp     : `${fullnodeHost}:${fullnodeSocketPort}`,
            interval: interval,
            deregister_critical_service_after: deregister
        }
    }]
}

ConsulService.prototype.deregisterService = function (service, callback) {
    this.consul.agent.service.deregister({ id: service.id }, (err) => {
        if (err) {
            return callback(err)
        }
        
        return callback(null)
    });
}

ConsulService.prototype.register = () => {
    return new Promise((resolve, reject) => {
        // assuming openFiles is an array of file names
        async.each(this.services, (service, callback) => {
            // Register insight service to consul
            this.consul.agent.service.register(service, err => {
                if (err) {
                    return callback(err)
                }

                if (service.check.ttl) {
                    setInterval(() => {
                        this.consul.agent.check.pass({ 
                            id  : `service:${service.id}`,
                            note: `Notes`
                        }, err => {
                            if (err) {
                                return
                            }
                        });
                    }, parseInt(service.check.ttl) * 1000);
                }

                return callback(null)
            });
        }, (err) => {
            if (err) {
                return reject(err)
            }

            return resolve(null)
        });
    })
}

ConsulService.prototype.deregister = () => {
    return new Promise((resolve, reject) => {
        // assuming openFiles is an array of file names
        async.each(this.services, (service, callback) => {
            this.deregisterService(service, (err) => {
                return callback(null)
            })
        }, (err) => {
            return resolve(null)
        });
    })
}

ConsulService.prototype.healthcheck = (req, res) => {
    let result = {
        coin                : options.coin,
        lastest_block       : this.node.services.bitcoind.height,
        block_delay_limit   : options.maxDelay,
        app_version         : "",
        git_version         : ""
    }

    return res.jsonp({
        cd   : "0",
        data : result
    });
}

module.exports = ConsulService;