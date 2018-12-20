const windowAlert = require('../helper/window-alert')
const clusterService = require('../service/cluster')
const redisService = require('../service/redis')

module.exports = async (host, port, user, password, key) => {
  try {
    await redisService.setupSSHTunnel(host, port, user, password, key)
    clusterService.reset()
  } catch (err) {
    windowAlert(err.message)
  }
}
