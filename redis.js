const fs = require('fs')
const util = require('util')
const { exec, spawn } = require('child_process')
const { Client } = require('ssh2')
const debug = require('debug')('redis-cluster-ui:redis')

const localExecAsync = util.promisify(exec)

class CommandError extends Error {
  constructor (command, code, stdout, stderr) {
    super(`Command failed: ${command}`)
    this.code = code
    this.stdout = stdout
    this.stderr = stderr
  }
}

class RedisCli {
  async setupSSHTunnel (host, port, user, password, key) {
    debug('ssh connect params', host, user, key, port)
    const self = this
    return new Promise((resolve, reject) => {
      const conn = new Client()
      conn.on('ready', function () {
        debug('ssh connection ready')
        self.conn = conn
        resolve(conn)
      }).on('error', function (err) {
        debug('ssh connection failed', err)
        reject(err)
      }).connect({
        host,
        port,
        username: user,
        password,
        privateKey: key ? fs.readFileSync(key) : undefined
      })
    })
  }

  async execAsync (command) {
    debug('execute', command)
    const execAsync = this.conn ? this.sshExecAsync.bind(this) : localExecAsync
    const result = await execAsync(command)
    debug('output', 'stdout', result.stdout, 'stderr', result.stderr)
    return result
  }

  async sshExecAsync (command) {
    return new Promise((resolve, reject) => {
      this.conn.exec(`PATH=$PATH:/usr/local/bin bash -c '${command}'`, function (err, stream) {
        if (err) return reject(err)

        let stdout = ''
        let stderr = ''
        stream.on('close', function (code, signal) {
          resolve({ code, stdout, stderr })
        }).on('data', function (data) {
          stdout += data
        }).stderr.on('data', function (data) {
          stderr += data
        })
      })
    })
  }

  async createCluster (tuples) {
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

  async getClusterNodes (tuple) {
    const [host, port] = tuple.split(':')
    const command = `redis-cli -h ${host} -p ${port} CLUSTER NODES`
    const { stdout, stderr } = await this.execAsync(command)

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
      .filter(node => !node.flags.includes('fail'))
  }

  async addNode (newTuple, oldTuple) {
    const command = `redis-cli --cluster add-node ${newTuple} ${oldTuple}`
    const { stdout, stderr } = await this.execAsync(command)

    if (this.isCommandFailed(stdout)) {
      throw new CommandError(command, 0, stdout, stderr)
    }

    return stdout
  }

  async replicate (tuple, nodeId) {
    const [host, port] = tuple.split(':')
    const command = `redis-cli -h ${host} -p ${port} CLUSTER REPLICATE ${nodeId}`
    const { stdout, stderr } = await this.execAsync(command)

    if (this.isCommandFailed(stdout)) {
      throw new CommandError(command, 0, stdout, stderr)
    }

    return stdout
  }

  async rebalance (tuple) {
    const command = `redis-cli --cluster rebalance ${tuple} --cluster-use-empty-masters`
    const { stdout, stderr } = await this.execAsync(command)

    if (this.isCommandFailed(stdout)) {
      throw new CommandError(command, 0, stdout, stderr)
    }

    return stdout
  }

  isCommandFailed (stdout) {
    return stdout.indexOf('ERR') === 0
  }
}

module.exports = new RedisCli()
