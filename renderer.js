const os = require('os')
const { remote: { dialog } } = require('electron')
const redis = require('./redis')
const { draw, emitter, createDiagram, updateDiagram } = require('./topology')

let nodes = []

connectCluster('127.0.0.1:7001')
window.localStorage.debug = 'redis-cluster-ui:*'

$('button.connect-server').click(() => {
  const $content = $(`
    <div class="description">
        <form class="ui large form">
            <div class="ui stacked segment">
                <div class="field">
                    <div class="ui left icon input">
                        <i class="desktop icon"></i>
                        <input type="text" name="host" placeholder="Host">
                    </div>
                </div>
                <div class="field">
                    <div class="ui left icon input">
                        <i class="user icon"></i>
                        <input type="text" name="user" placeholder="User">
                    </div>
                </div>
                <div class="field">
                    <div class="ui left icon input">
                        <i class="key icon"></i>
                        <input type="text" name="key" placeholder="SSH Key">
                        <i class="folder open link icon" style="left: auto; right: .5em"></i>
                    </div>
                </div>
                <div class="field">
                    <div class="ui left icon input">
                        <i class="plug icon"></i>
                        <input type="text" name="port" placeholder="SSH Port" value="22">
                    </div>
                </div>
            </div>
            <div class="ui error message"></div>
        </form>
    </div>
  `)

  $content.find('.folder.open.icon').click(() => {
    dialog.showOpenDialog({
      title: 'Select SSH private key',
      defaultPath: `${os.homedir()}/.ssh`,
      properties: ['openFile', 'showHiddenFiles']
    }, filePaths => {
      if (filePaths && filePaths[0]) {
        $content.find('input[name="key"]').val(filePaths[0])
      }
    })
  })

  const $modal = createModal({
    body: $content,
    title: 'Connect to Remote Server'
  })

  $modal
    .modal('show')
    .modal({
      onApprove: function () {
        const [host, user, key, port] = $content.find('input').map(function () { return this.value }).get()
        connectServer(host, port, user, null, key).catch(errorHandler)
      }
    })
})

$('button.create-cluster').click(() => {
  const $content = $(`
    <div class="description">
      <div class="ui form">
        <div class="field">
          <label>Redis Host:Port tuples</label>
          <textarea />
        </div>
      </div>
    </div>
  `)

  const $modal = createModal({
    body: $content,
    title: 'Create Cluster'
  })

  $modal
    .modal({
      onApprove: function () {
        const content = $content.find('textarea').val().trim()
        const tuples = content.split(/\s+/).map(s => s.trim())
        createCluster(tuples).catch(errorHandler)
      }
    })
    .modal('show')
})

$('button.connect-cluster').click(() => {
  const $content = $(`
    <div class="description">
      <div class="ui form">
        <div class="field">
          <label>Redis Host:Port tuples</label>
          <textarea />
        </div>
      </div>
    </div>
  `)

  const $modal = createModal({
    body: $content,
    title: 'Connect Cluster'
  })

  $modal
    .modal({
      onApprove: function () {
        const content = $content.find('textarea').val().trim()
        connectCluster(content).catch(errorHandler)
      }
    })
    .modal('show')
})

$('button.add-node').click(() => {
  const $content = $(`
    <div class="description">
      <div class="ui form">
        <div class="field">
          <label>Redis Host:Port tuples</label>
          <textarea />
        </div>
      </div>
    </div>
  `)

  const $modal = createModal({
    body: $content,
    title: 'Add Node'
  })

  $modal
    .modal({
      onApprove: function () {
        const content = $content.find('textarea').val().trim()
        addNode(content).catch(errorHandler)
      }
    })
    .modal('show')
})

$('button.rebalance').click(() => {
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
  render(nodes)
}

async function connectCluster (tuple) {
  nodes = await redis.getClusterNodes(tuple)
  render(nodes)
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
    // write node info
    await redis.writeInfoByNode(nodes[0].tuple)

    // get node info
    const newNodes = await redis.getClusterNodes(nodes[0].tuple)

    // render
    render(newNodes)
    nodes = newNodes
  }
}, 1000)

// function formatNodeInfoKey (str) {
//   return str.replace(/_/g, ' ').toUpperCase()
// }

function convertContentIntoObject (info) {
  info = info.split('\n')

  let result = {}
  for (let line of info) {
    line = line.trim()
    if (line.length === 0) continue
    if (line.indexOf('# ') !== -1) continue

    const [key, value] = line.split(':')
    result[key] = value
  }

  return result
}

let timeout

function render (nodes) {
  draw(nodes, {
    onClick: function (node) {
      if (timeout) clearTimeout(timeout)
      timeout = null

      const $content = $(`<div class="description" />`)
      let interval

      const $modal = createModal({
        action: '',
        body: $content,
        className: 'longer',
        title: 'Node Info'
      })

      $modal
        .modal({
          onHide: function () {
            if (interval) {
              clearInterval(interval)
              interval = null
            }
          }
        })
        .modal('show')

      const usedSystemCPUContainer = $('<div />')
      $content.append(usedSystemCPUContainer)

      const usedUserCPUContainer = $('<div />')
      $content.append(usedUserCPUContainer)

      const usedMemoryContainer = $('<div />')
      $content.append(usedMemoryContainer)

      timeout = setTimeout(() => {
        const width = $content.width()

        const usedSystemCPUOption = {
          container: usedSystemCPUContainer.get(0),
          data: [],
          height: 500,
          title: 'Used System CPU',
          width: width
        }
        const usedSystemCPUDiagram = createDiagram(usedSystemCPUOption)

        const usedUserCPUOption = {
          container: usedUserCPUContainer.get(0),
          data: [],
          height: 500,
          title: 'Used User CPU',
          width: width
        }
        const usedUserCPUDiagram = createDiagram(usedUserCPUOption)

        const usedMemoryOption = {
          container: usedMemoryContainer.get(0),
          data: [],
          height: 500,
          title: 'Memory',
          width: width
        }
        const usedMemoryDiagram = createDiagram(usedMemoryOption)

        interval = setInterval(async () => {
          const allInfo = await redis.readAllInfoByNode(node.tuple)
          const allResults = allInfo.map((v) => ({ date: new Date(parseInt(v.date, 10)), value: convertContentIntoObject(v.content) }))

          const usedSystemCPUData = allResults.map((v) => Object.assign({}, v, { value: v.value['used_cpu_sys'] }))
          updateDiagram(Object.assign({}, usedSystemCPUOption, usedSystemCPUDiagram, { data: usedSystemCPUData }))

          const usedUserCPUData = allResults.map((v) => Object.assign({}, v, { value: v.value['used_cpu_user'] }))
          updateDiagram(Object.assign({}, usedUserCPUOption, usedUserCPUDiagram, { data: usedUserCPUData }))

          const usedMemoryData = allResults.map((v) => Object.assign({}, v, { value: v.value['used_memory'] / 1024 }))
          updateDiagram(Object.assign({}, usedMemoryOption, usedMemoryDiagram, { data: usedMemoryData }))

          const scrollTop = $content.scrollTop()
          $content.scrollTop(scrollTop)
        }, 1000)
      }, 500)
    }
  })
}

function errorHandler (err) {
  window.alert(err.stdout + '\n' + err.stderr)
}

function createModal (opt) {
  const { action, body, className, title } = opt

  const $modal = $(`
    <div class="ui modal">
      <div class="header" />
      <div class="content scrolling" />
      <div class="actions" />
    </div>
  `)

  $modal.addClass(className)

  $modal.find('.actions').append(action != null ? action : `
    <button class="ui black deny button" type="button">Cancel</button>
    <button class="ui positive right button" type="button">OK</button>
  `)

  $modal.find('.header').append(title)
  $modal.find('.content').append(body)

  return $modal
}
