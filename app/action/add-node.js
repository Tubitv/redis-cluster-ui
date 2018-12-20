const windowAlert = require('../helper/window-alert')
const cluster = require('../service/cluster')
const redis = require('../service/redis')

module.exports = async (input) => {
  try {
    const clusterNodes = cluster.getNodes()
    if (clusterNodes.length) {
      await redis.addNode(input, clusterNodes[0].tuple)
    }
  } catch (err) {
    windowAlert(err.message)
  }
}
