const util = require('util')
const { exec, spawn } = require('child_process')
const debug = require('debug')('redis-cluster-ui:redis')

const execAsync = util.promisify(exec)

async function createCluster (tuples) {
  return new Promise((resolve, reject) => {
    const args = ['--cluster', 'create'].concat(tuples)
    const create = spawn('redis-cli', args)
    let stdout = ''
    let stderr = ''

    create.stdout.on('data', (data) => {
      stdout += data
      if (data.includes('type \'yes\' to accept')) {
        const confirmed = window.confirm(data)
        create.stdin.write(confirmed ? 'yes' : 'no')
      }
    })

    create.stderr.on('data', (data) => {
      stderr += data
    })

    create.on('close', (code) => {
      debug('createCluster', code, stdout, stderr)
      if (code !== 0) {
        const err = new Error('Command faild: redis-cli ' + args.join(' '))
        err.code = code
        err.stderr = stderr
        err.stdout = stdout
        return reject(err)
      }
      resolve({ code, stderr, stdout })
    })
  })
}

async function getClusterNodes (tuple) {
  const [host, port] = tuple.split(':')
  const { stdout, stderr } = await execAsync(`redis-cli -h ${host} -p ${port} CLUSTER NODES`)
  debug('getClusterNodes', stdout, stderr)
  return stdout.trim().split('\n').map(line => {
    let [id, tuple, flags, master, pingSent, pongRecv, configEpoch, linkState, ...slots] = line.split(' ')
    tuple = tuple.split('@')[0]
    if (tuple[0] === ':') {
      tuple = '127.0.0.1' + tuple
    }
    flags = flags.split(',')
    slots = slots.map(slot => slot.split('-'))
    return { id, tuple, flags, master, pingSent, pongRecv, configEpoch, linkState, slots }
  })
}

async function addNode (newTuple, oldTuple) {
  const { stdout, stderr } = await execAsync(`redis-cli --cluster add-node ${newTuple} ${oldTuple}`)
  debug('addNode', stdout, stderr)
  // wait for node broadcast to whole cluster
  await delay(500)
  return stdout
}

async function replicate (tuple, nodeId) {
  const [host, port] = tuple.split(':')
  const { stdout, stderr } = await execAsync(`redis-cli -h ${host} -p ${port} CLUSTER REPLICATE ${nodeId}`)
  debug('replicate', stdout, stderr)
  await delay(500)
  return stdout
}

async function delay (timeout) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout)
  })
}

module.exports = { createCluster, getClusterNodes, addNode, replicate }
