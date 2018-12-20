const EventEmitter = require('events')

const redis = require('./redis')

class ClusterService extends EventEmitter {
  constructor () {
    super()

    this.nodes = []
    this.tuple = null
  }

  async refreshNodes () {
    if (this.tuple) {
      const clusterNodes = await redis.getClusterNodes(this.tuple)
      this.setNodes(clusterNodes)
    }
  }

  getNodes () {
    return this.nodes
  }

  setNodes (newNodes) {
    this.nodes = newNodes
    this.emit('update', this.nodes)
  }

  setTuple (newTuple) {
    this.tuple = newTuple
  }

  reset () {
    this.nodes = []
    this.tuple = null
    this.emit('reset')
  }
}

module.exports = new ClusterService()
