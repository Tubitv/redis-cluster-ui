const windowAlert = require('../helper/window-alert')
const redis = require('../service/redis')

module.exports = async (from, to) => {
  try {
    await redis.replicate(from.tuple, to.id)
  } catch (err) {
    windowAlert(err.message)
  }
}
