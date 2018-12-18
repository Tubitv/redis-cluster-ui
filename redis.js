const util = require('util')
const { exec, spawn } = require('child_process')
const debug = require('debug')('redis-cluster-ui:redis')

const execAsync = util.promisify(exec)

class CommandError extends Error {
  constructor (command, code, stdout, stderr) {
    super(`Command failed: ${command}`)
    this.code = code
    this.stdout = stdout
    this.stderr = stderr
  }
}

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
        return reject(new CommandError('redis-cli ' + args.join(' '), code, stdout, stderr))
      }
      resolve()
    })
  })
}

async function getClusterNodes (tuple) {
  const [host, port] = tuple.split(':')
  const command = `redis-cli -h ${host} -p ${port} CLUSTER NODES`
  const { stdout, stderr } = await execAsync(command)
  debug('getClusterNodes', stdout, stderr)

  if (stderr) {
    throw new CommandError(command, 0, stdout, stderr)
  }

  return stdout
    .trim()
    .split('\n')
    .map(line => {
      let [id, tuple, flags, master, pingSent, pongRecv, configEpoch, linkState, ...slots] = line.split(' ')
      tuple = tuple.split('@')[0]
      if (tuple[0] === ':') {
        tuple = '127.0.0.1' + tuple
      }
      flags = flags.split(',')
      const isMaster = flags.includes('master')
      slots = slots.map(slot => slot.split('-'))
      return { id, tuple, flags, isMaster, master, pingSent, pongRecv, configEpoch, linkState, slots }
    })
    .sort((a, b) => a.tuple > b.tuple)
}

async function addNode (newTuple, oldTuple) {
  const command = `redis-cli --cluster add-node ${newTuple} ${oldTuple}`
  const { stdout, stderr } = await execAsync(command)
  debug('addNode', stdout, stderr)

  if (isCommandFailed(stdout)) {
    throw new CommandError(command, 0, stdout, stderr)
  }

  return stdout
}

async function replicate (tuple, nodeId) {
  const [host, port] = tuple.split(':')
  const command = `redis-cli -h ${host} -p ${port} CLUSTER REPLICATE ${nodeId}`
  const { stdout, stderr } = await execAsync(command)
  debug('replicate', stdout, stderr)

  if (isCommandFailed(stdout)) {
    throw new CommandError(command, 0, stdout, stderr)
  }

  return stdout
}

async function rebalance (tuple) {
  const command = `redis-cli --cluster rebalance ${tuple} --cluster-use-empty-masters`
  const { stdout, stderr } = await execAsync(command)
  debug('rebalance', stdout, stderr)

  if (isCommandFailed(stdout)) {
    throw new CommandError(command, 0, stdout, stderr)
  }

  return stdout
}

function isCommandFailed (stdout) {
  return stdout.indexOf('ERR') === 0
}

module.exports = { createCluster, getClusterNodes, addNode, replicate, rebalance }
