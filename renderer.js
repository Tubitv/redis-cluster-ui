const os = require('os')
const { remote: { dialog } } = require('electron')
// const debug = require('debug')('redis-cluster-ui:renderer')
const redis = require('./redis')
const { draw, emitter } = require('./topology')

let nodes = []

window.localStorage.debug = 'redis-cluster-ui:*'

$('button.connect-server').click(() => {
  $('.ui.modal.connect')
    .modal('show')
    .modal({
      onApprove: function () {
        const [host, user, key, port] = $('.ui.modal.connect input').map(function () { return this.value }).get()
        connectServer(host, port, user, null, key).catch(errorHandler)
      }
    })
})

$('.folder.open.icon').click(() => {
  dialog.showOpenDialog({
    title: 'Select SSH private key',
    defaultPath: `${os.homedir()}/.ssh`,
    properties: ['openFile', 'showHiddenFiles']
  }, filePaths => {
    if (filePaths && filePaths[0]) {
      $('.ui.modal.connect input[name="key"]').val(filePaths[0])
    }
  })
})

$('button.create-cluster').click(showModal('Create Cluster', (content) => {
  const tuples = content.split(/\s+/).map(s => s.trim())
  createCluster(tuples).catch(errorHandler)
}))

$('button.connect-cluster').click(showModal('Connect Cluster', (tuple) => {
  connectCluster(tuple).catch(errorHandler)
}))

$('button.add-node').click(showModal('Add Node', (tuple) => {
  addNode(tuple).catch(errorHandler)
}))

$('.button.rebalance').click(() => {
  if (window.confirm('Do you really want to rebalance slots and use empty masters?')) {
    rebalance().catch(errorHandler)
  }
})

emitter.on('addLink', (from, to) => {
  addLink(from, to).catch(errorHandler)
})

async function connectServer (host, port, user, password, key) {
  return redis.setupSSHTunnel(host, port, user, password, key)
}

async function createCluster (tuples) {
  await redis.createCluster(tuples)
  nodes = await redis.getClusterNodes(tuples[0])
  draw(nodes)
}

async function connectCluster (tuple) {
  nodes = await redis.getClusterNodes(tuple)
  draw(nodes)
}

async function addNode (tuple) {
  await redis.addNode(tuple, nodes[0].tuple)
}

async function addLink (from, to) {
  await redis.replicate(from.tuple, to.id)
}

async function rebalance () {
  await redis.rebalance(nodes[0].tuple)
}

setInterval(async () => {
  if (nodes.length) {
    const newNodes = await redis.getClusterNodes(nodes[0].tuple)
    draw(newNodes)
    nodes = newNodes
  }
}, 1000)

function errorHandler (err) {
  window.alert(err.stdout + '\n' + err.stderr)
}

function showModal (action, callback) {
  return function () {
    $('.ui.modal.tuple .header').html(action)
    $('.ui.modal.tuple .actions .right').html(action)
    $('.ui.modal.tuple textarea').val('')
    $('.ui.modal.tuple')
      .modal('show')
      .modal({
        onApprove: function () {
          const content = $('.ui.modal textarea').val().trim()
          callback(content)
        }
      })
  }
}
