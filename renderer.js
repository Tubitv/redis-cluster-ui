const util = require('util')
const { exec, spawn } = require('child_process')
const { draw } = require('./topology')

const execAsync = util.promisify(exec)

window.spawn = spawn
window.execAsync = execAsync

let nodes = []

$('.ui.modal.create-cluster textarea').val(['127.0.0.1:7001', '127.0.0.1:7002', '127.0.0.1:7003'].join('\n'))
$('.ui.modal.connect-cluster input').val('127.0.0.1:7001')

$('button.create-cluster').click(() => {
  $('.ui.modal.create-cluster')
    .modal('show')
    .modal({
      onApprove: function () {
        const tuples = $('.ui.modal.create-cluster textarea').val().split(/\s+/).map(s => s.trim())
        createCluster(tuples).finally(() => {
          getClusterNodes(tuples[0]).then(_nodes => {
            nodes = _nodes
            console.log(nodes)
            draw(_nodes)
          })
        })
      }
    })
})

$('button.connect-cluster').click(() => {
  $('.ui.modal.connect-cluster')
    .modal('show')
    .modal({
      onApprove: function () {
        const tuple = $('.ui.modal.connect-cluster input').val().trim()
        getClusterNodes(tuple).then(_nodes => {
          nodes = _nodes
          draw(_nodes)
        })
      }
    })
})

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
  const { stdout } = await execAsync(`redis-cli -h ${host} -p ${port} CLUSTER NODES`)
  return stdout.trim().split('\n').map(line => {
    let [id, tuple, flags, master, pingSent, pongRecv, configEpoch, linkState, ...slots] = line.split(' ')
    tuple = tuple.split('@')[0]
    const [host, port] = tuple.split(':')
    flags = flags.split(',')
    slots = slots.map(slot => slot.split('-'))
    return { id, tuple, host, port, flags, master, pingSent, pongRecv, configEpoch, linkState, slots }
  })
}

async function addNode (newNode, oldNode) {
  return await execAsync(`redis-cli --cluster add-node ${newNode} ${oldNode}`)
}
