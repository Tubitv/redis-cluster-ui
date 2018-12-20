const windowAlert = require('../helper/window-alert')
const cluster = require('../service/cluster')
const redis = require('../service/redis')

module.exports = async (input) => {
  try {
    const clusterNodes = await redis.getClusterNodes(input)
    if (clusterNodes.length) {
      cluster.setTuple(input)
      cluster.setNodes(clusterNodes)
    }
  } catch (err) {
    windowAlert(err.message)
  }
}
