const windowAlert = require('../helper/window-alert')
const cluster = require('../service/cluster')
const redis = require('../service/redis')

module.exports = async () => {
  try {
    const clusterNodes = cluster.getNodes()
    if (clusterNodes.length) {
      await redis.rebalance(clusterNodes[0].tuple)
    }
  } catch (err) {
    windowAlert(`${err.stdout}\n${err.stderr}`)
  }
}
