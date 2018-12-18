const { isEqual } = require('lodash')
const redis = require('./redis')
const { draw, emitter } = require('./topology')

let nodes = []

connectCluster('127.0.0.1:7001')
window.localStorage.debug = 'redis-cluster-ui:*'

// $('button.create-cluster').click(() => {
//   $('.ui.modal textarea').val(['127.0.0.1:7001', '127.0.0.1:7002', '127.0.0.1:7003'].join('\n'))
// })
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

emitter.on('addLink', (from, to) => {
  addLink(from, to).catch(errorHandler)
})

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

setInterval(async () => {
  if (nodes.length) {
    const newNodes = await redis.getClusterNodes(nodes[0].tuple)
    if (!isEqual(newNodes, nodes)) {
      draw(newNodes)
      nodes = newNodes
    }
  }
}, 1000)

function errorHandler (err) {
  window.alert(err.stdout + '\n' + err.stderr)
}

function showModal (action, callback) {
  return function () {
    $('.ui.modal .header').html(action)
    $('.ui.modal .actions .right').html(action)
    $('.ui.modal textarea').val('')
    $('.ui.modal')
      .modal('show')
      .modal({
        onApprove: function () {
          const content = $('.ui.modal textarea').val().trim()
          callback(content)
        }
      })
  }
}
