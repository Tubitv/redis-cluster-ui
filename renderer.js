const util = require('util')
const { exec, spawn } = require('child_process')
const { createCluster: redisCreateCluster, getClusterNodes: redisGetClusterNodes, addNode: redisAddNode } = require('./redis')
const { draw } = require('./topology')

const execAsync = util.promisify(exec)

window.spawn = spawn
window.execAsync = execAsync

let nodes = []

connectCluster('127.0.0.1:7001')

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

function showModal (action, callback) {
  return function () {
    $('.ui.modal .header').html(action)
    $('.ui.modal .actions .right').html(action)
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

async function createCluster (tuples) {
  await redisCreateCluster(tuples)
  nodes = await redisGetClusterNodes(tuples[0])
  draw(nodes)
}

async function connectCluster (tuple) {
  nodes = await redisGetClusterNodes(tuple)
  draw(nodes)
}

async function addNode (tuple) {
  await redisAddNode(tuple, nodes[0].tuple)
  nodes = await redisGetClusterNodes(nodes[0].tuple)
  draw(nodes)
}
