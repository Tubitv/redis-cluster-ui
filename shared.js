const tmp = require('tmp')

const tmpDir = tmp.dirSync({ prefix: 'redis-cluster-ui_' })

module.exports = {
  tmpDir
}
