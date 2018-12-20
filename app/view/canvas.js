const debug = require('debug')('redis-cluster-ui:redis')
const EventEmitter = require('events')

module.exports = class Canvas extends EventEmitter {
  constructor () {
    super()

    this.clusterLinks = []
    this.clusterNodes = []
  }

  update (newClusterNodes) {
    // add new nodes
    for (const newClusterNode of newClusterNodes) {
      const existedClusterNode = this._findClusterNode(newClusterNode.id)
      if (!existedClusterNode) {
        this.clusterNodes.push(newClusterNode)
      } else {
        // update other fields for existing nodes
        for (const key in newClusterNode) {
          existedClusterNode[key] = newClusterNode[key]
        }
      }
    }

    // remove old nodes
    this.clusterNodes = this.clusterNodes.filter((clusterNode) => {
      return newClusterNodes.some((newClusterNode) => newClusterNode.id === clusterNode.id)
    })

    // add new links
    const newNonMasterClusterNodes = newClusterNodes.filter((newClusterNode) => !newClusterNode.isMaster)
    for (const newNonMasterClusterNode of newNonMasterClusterNodes) {
      const newClusterLink = this._getClusterLinkFromClusterNodes(newClusterNodes, newNonMasterClusterNode)
      const existedClusterLink = this.clusterLinks.find(
        (clusterLink) => clusterLink.source.id === newClusterLink.source.id && clusterLink.target.id === newClusterLink.target.id
      )

      if (!existedClusterLink) {
        this.clusterLinks.push(newClusterLink)
      }
    }

    // remove old links
    this.clusterLinks = this.clusterLinks.filter((clusterLink) => {
      return newClusterNodes.find((newClusterNode) => {
        if (!newClusterNode.isMaster) {
          const newClusterLink = this._getClusterLinkFromClusterNodes(newClusterNodes, newClusterNode)

          return clusterLink.source.id === newClusterLink.source.id && clusterLink.target.id === newClusterLink.target.id
        }

        return false
      })
    })

    debug('cluster nodes', this.clusterNodes)
    debug('cluster links', this.clusterLinks)

    this.emit('update', this.clusterNodes, this.clusterLinks)
  }

  _findClusterNode (targetClusterNodeId) {
    return this.clusterNodes.find((clusterNode) => clusterNode.id === targetClusterNodeId)
  }

  _getClusterLinkFromClusterNodes (clusterNodes, targetClusterNode) {
    const from = this._findClusterNode(targetClusterNode.id)
    const to = this._findClusterNode(clusterNodes.find((n) => n.id === targetClusterNode.master).id)
    const isRight = from.id < to.id
    const source = isRight ? from : to
    const target = isRight ? to : from
    return { source, target, left: !isRight, right: isRight }
  }
}
