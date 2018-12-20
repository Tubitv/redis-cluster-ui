const windowAlert = require('../helper/window-alert')
const redis = require('../service/redis')

module.exports = async (host, port, user, password, key) => {
  try {
    await redis.setupSSHTunnel(host, port, user, password, key)
  } catch (err) {
    windowAlert(`${err.stdout}\n${err.stderr}`)
  }
}
