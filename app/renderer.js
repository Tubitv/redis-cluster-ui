const fastdom = require('fastdom')

const addLink = require('./action/add-link')
const connectCluster = require('./action/connect-cluster')
const clusterService = require('./service/cluster')
const redisService = require('./service/redis')
const Canvas = require('./view/canvas')
const GraphDiagram = require('./view/graph-diagram')
const GraphTopology = require('./view/graph-topology')

// connect default server
connectCluster('127.0.0.1:7001')
window.localStorage.debug = 'redis-cluster-ui:*'

// import views
require('./view/bind-add-node')
require('./view/bind-connect-cluster')
require('./view/bind-connect-server')
require('./view/bind-create-cluster')
require('./view/bind-rebalance')

// canvas
const canvas = new Canvas()

// graph nodes
const graphTopologyContainerId = '#graph-node'
const graphTopology = new GraphTopology({ height: 0, width: 0, id: graphTopologyContainerId })

const resize = () => {
  let height = 0
  let width = 0

  fastdom.measure(() => {
    const container = document.querySelector(graphTopologyContainerId)
    const header = document.querySelector('header')
    const footer = document.querySelector('footer')

    height = document.body.clientHeight - header.clientHeight - footer.clientHeight
    width = container.getBoundingClientRect().width
  })

  fastdom.mutate(() => {
    graphTopology.resize(height, width)
  })
}

window.addEventListener('resize', resize)
resize()

clusterService.on('update', (clusterNodes) => {
  canvas.update(clusterNodes)
})

canvas.on('update', (clusterNodes, clusterLinks) => {
  graphTopology.update(clusterNodes, clusterLinks)
})

graphTopology.on('link', (from, to) => {
  addLink(from, to)
})

// graph diagrams

graphTopology.on('click', (node) => {
  const graphDiagram = new GraphDiagram({ redisService, node })
  graphDiagram.create()
})

// scheduler
setInterval(() => {
  clusterService.refreshNodes()
}, 1000)
