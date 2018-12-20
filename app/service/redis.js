const { exec, spawn } = require('child_process')
const debug = require('debug')('redis-cluster-ui:redis')
const fs = require('fs')
const { Client } = require('ssh2')
const util = require('util')

const localExecAsync = util.promisify(exec)

class CommandError extends Error {
  constructor (command, code, stdout, stderr) {
    super(`Command failed: ${command}`)
    this.code = code
    this.stdout = stdout
    this.stderr = stderr
  }
}

class RedisService {
  async setupSSHTunnel (host, port, user, password, key) {
    debug('ssh connect params', host, user, key, port)
    return new Promise((resolve, reject) => {
      const conn = new Client()
      conn
        .on('ready', () => {
          debug('ssh connection ready')
          this.conn = conn
          resolve(conn)
        })
        .on('error', (err) => {
          debug('ssh connection failed', err)
          reject(new CommandError('ssh connect failed', 1, '', err))
        })
        .connect({
          host,
          port,
          username: user,
          password,
          privateKey: key ? fs.readFileSync(key) : undefined
        })
    })
  }

  async createCluster (tuples) {
    const handler = (data, { stdin }) => {
      if (data.includes("type 'yes' to accept")) {
        const confirmed = window.confirm(data)
        stdin.write(confirmed ? 'yes' : 'no')
      }
    }
    const { stdout } = await this._execAsync('redis-cli --cluster create ' + tuples.join(' '), handler)

    return stdout
  }

  async getClusterNodes (tuple) {
    const [host, port] = tuple.split(':')
    const command = `redis-cli -h ${host} -p ${port} CLUSTER NODES`
    const { stdout, stderr } = await this._execAsync(command)

    if (stderr) throw new CommandError(command, 0, stdout, stderr)

    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        let [id, tuple, flags, master, pingSent, pongRecv, configEpoch, linkState, ...slots] = line.split(' ')
        tuple = tuple.split('@')[0]
        if (tuple[0] === ':') tuple = '127.0.0.1' + tuple
        flags = flags.split(',')
        const isMaster = flags.includes('master')
        slots = slots.map((slot) => slot.split('-'))
        return { id, tuple, flags, isMaster, master, pingSent, pongRecv, configEpoch, linkState, slots }
      })
      .sort((a, b) => a.tuple > b.tuple)
      .filter((node) => !node.flags.includes('fail'))
  }

  async addNode (newTuple, oldTuple) {
    const command = `redis-cli --cluster add-node ${newTuple} ${oldTuple}`
    const { stdout, stderr } = await this._execAsync(command)

    if (this._isCommandFailed(stdout)) throw new CommandError(command, 0, stdout, stderr)

    return stdout
  }

  async replicate (tuple, nodeId) {
    const [host, port] = tuple.split(':')
    const command = `redis-cli -h ${host} -p ${port} CLUSTER REPLICATE ${nodeId}`
    const { stdout, stderr } = await this._execAsync(command)

    if (this._isCommandFailed(stdout)) throw new CommandError(command, 0, stdout, stderr)

    return stdout
  }

  async readClusterNodeInfo (tuple) {
    const [host, port] = tuple.split(':')
    const command = `redis-cli -h ${host} -p ${port} info`
    const { stdout, stderr } = await this._execAsync(command)

    if (this._isCommandFailed(stdout)) throw new CommandError(command, 0, stdout, stderr)

    return stdout
  }

  async _execAsync (command, interactiveHandler) {
    const isRemoteExec = !!this.conn
    debug('execute', isRemoteExec ? 'remote' : 'local', { command })

    const execAsync = isRemoteExec ? this._sshExecAsync.bind(this) : interactiveHandler ? this._localSpawnAsync.bind(this) : localExecAsync
    const result = await execAsync(command, interactiveHandler)
    const { stdout, stderr } = result
    debug('output', { stdout, stderr })

    return result
  }

  async _localSpawnAsync (command, interactiveHandler = () => {}) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(/\s+/)
      const child = spawn(cmd, args)
      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data
        interactiveHandler(data, { stdin: child.stdin, stdout: child.stdout, stderr: child.stderr })
      })

      child.stderr.on('data', (data) => {
        stderr += data
      })

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new CommandError(command, code, stdout, stderr))
        }
        resolve({ code, stdout, stderr })
      })
    })
  }

  async _sshExecAsync (command, interactiveHandler = () => {}) {
    return new Promise((resolve, reject) => {
      this.conn.exec(`PATH=$PATH:/usr/local/bin bash -c '${command}'`, (err, stream) => {
        if (err) return reject(err)

        let stdout = ''
        let stderr = ''
        stream
          .on('close', (code, signal) => {
            resolve({ code, stdout, stderr })
          })
          .on('data', (data) => {
            stdout += data
            interactiveHandler(data, { stdin: stream, stdout: stream, stderr: stream.stderr })
          })
          .stderr.on('data', (data) => {
            stderr += data
          })
      })
    })
  }

  _isCommandFailed (stdout) {
    return stdout.indexOf('ERR') === 0
  }
}

module.exports = new RedisService()
