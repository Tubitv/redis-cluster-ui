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
  createCluster(tuples)
}))

$('button.connect-cluster').click(showModal('Connect Cluster', (tuple) => {
  connectCluster(tuple)
}))

$('button.add-node').click(showModal('Add Node', (tuple) => {
  addNode(tuple)
}))

emitter.on('addLink', addLink)

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
  nodes = await redis.getClusterNodes(nodes[0].tuple)
  draw(nodes)
}

async function addLink (from, to) {
  const node = nodes.find(node => node.tuple === to)
  await redis.replicate(from, node.id)
  nodes = await redis.getClusterNodes(nodes[0].tuple)
  draw(nodes)
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
