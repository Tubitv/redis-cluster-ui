const windowAlert = require('../helper/window-alert')
const redis = require('../service/redis')
const connectCluster = require('./connect-cluster')

module.exports = async (tuples) => {
  try {
    await redis.createCluster(tuples)
    if (tuples.length) await connectCluster(tuples[0])
  } catch (err) {
    windowAlert(err.message)
  }
}
