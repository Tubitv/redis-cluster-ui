const os = require('os')
const { remote: { dialog } } = require('electron')
const redis = require('./redis')
const { draw, emitter } = require('./topology')

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
    const newNodes = await redis.getClusterNodes(nodes[0].tuple)
    render(newNodes)
    nodes = newNodes
  }
}, 1000)

function render (nodes) {
  draw(nodes, {
    onClick: function (node) {
      const $content = $(`<div class="description" />`)
      $content.html('Loading...')

      let interval = setInterval(async () => {
        const info = await redis.getClusterNodeInfo(node.tuple)
        const $topNode = $(`<div />`)

        for (const title in info) {
          const $title = $(`<h4>${title}</h4>`)
          $topNode.append($title)
          for (const key in info[title]) {
            const val = info[title][key]

            const $childNode = $('<p />')
            $childNode.append($(`<span>${key}: </span>`))
            $childNode.append($(`<span>${val}</span>`))

            $topNode.append($childNode)
          }
        }

        const scrollTop = $content.scrollTop()
        $content.html($topNode)
        $content.scrollTop(scrollTop)
      }, 1000)

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

  $modal.find('.title').append(title)
  $modal.find('.content').append(body)

  return $modal
}
