const connectCluster = require('../action/connect-cluster')
const modal = require('../component/modal')

const $trigger = $('#connect-cluster')

const getContent = () => $(`
  <div class="description">
    <div class="ui form">
      <div class="field">
        <label>Redis Host:Port tuples</label>
        <textarea />
      </div>
    </div>
  </div>
`)

$trigger.click(() => {
  const $content = getContent()

  const $modal = modal.create({
    body: $content,
    title: 'Connect Cluster'
  })

  $modal
    .modal({
      onApprove: () => {
        const content = $content
          .find('textarea')
          .val()
          .trim()

        connectCluster(content)
      }
    })
    .modal('show')
})
