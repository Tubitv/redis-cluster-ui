const { exec, spawn } = require('child_process')
const debug = require('debug')('redis-cluster-ui:redis')
const fs = require('fs')
const path = require('path')
const { Client } = require('ssh2')
const util = require('util')

const shared = require('../shared')

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
  isCommandFailed (stdout) {
    return stdout.indexOf('ERR') === 0
  }

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
        reject(new CommandError('ssh connect failed', 1, '', err))
      }).connect({
        host,
        port,
        username: user,
        password,
        privateKey: key ? fs.readFileSync(key) : undefined
      })
    })
  }

  async execAsync (command, interactiveHandler) {
    const isRemoteExec = !!this.conn
    debug('execute', isRemoteExec ? 'remote' : 'local', 'command', command)

    const execAsync = isRemoteExec ? this.sshExecAsync.bind(this) : (interactiveHandler ? this.localSpawnAsync.bind(this) : localExecAsync)
    const result = await execAsync(command, interactiveHandler)
    debug('output', 'stdout', result.stdout, 'stderr', result.stderr)

    return result
  }

  async sshExecAsync (command, interactiveHandler = function () {}) {
    return new Promise((resolve, reject) => {
      this.conn.exec(`PATH=$PATH:/usr/local/bin bash -c '${command}'`, function (err, stream) {
        if (err) return reject(err)

        let stdout = ''
        let stderr = ''
        stream.on('close', function (code, signal) {
          resolve({ code, stdout, stderr })
        }).on('data', function (data) {
          stdout += data
          interactiveHandler(data, { stdin: stream, stdout: stream, stderr: stream.stderr })
        }).stderr.on('data', function (data) {
          stderr += data
        })
      })
    })
  }

  async localSpawnAsync (command, interactiveHandler = function () {}) {
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

  async createCluster (tuples) {
    const handler = (data, { stdin }) => {
      if (data.includes('type \'yes\' to accept')) {
        const confirmed = window.confirm(data)
        stdin.write(confirmed ? 'yes' : 'no')
      }
    }
    const { stdout } = await this.execAsync('redis-cli --cluster create ' + tuples.join(' '), handler)
    return stdout
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

  /**
   * write info
   */

  getRunId (info) {
    return (info.split('\n').filter((s) => s.indexOf('run_id') === 0)[0]).split(':')[1]
  }

  async readNodeInfoByCli (address) {
    const [host, port] = address.split(':')
    const command = `redis-cli -h ${host} -p ${port} info`
    const { stdout, stderr } = await this.execAsync(command)

    if (this.isCommandFailed(stdout)) {
      throw new CommandError(command, 0, stdout, stderr)
    }

    return stdout
  }

  async writeInfoByNode (address) {
    const date = new Date()

    const info = await this.readNodeInfoByCli(address)
    const runId = this.getRunId(info)

    const fileName = path.join(shared.tmpDir.name, `${runId}_${date.valueOf()}`)

    await fs.writeFileSync(fileName, info, { encoding: 'utf8' })
  }

  /**
   * read & write info
   */

  async readAllInfoByNode (address) {
    const info = await this.readNodeInfoByCli(address)
    const runId = this.getRunId(info)

    let files = await fs.readdirSync(shared.tmpDir.name)
    files = files.filter((v) => v.indexOf(runId) !== -1)

    let result = []
    for (const v of files) {
      const [runId, date] = v.split('_')
      const fileName = path.join(shared.tmpDir.name, v)
      const content = await fs.readFileSync(fileName, { encoding: 'utf-8' })
      result.push({ content, runId, date })
    }

    return result
  }
}

module.exports = new RedisCli()
