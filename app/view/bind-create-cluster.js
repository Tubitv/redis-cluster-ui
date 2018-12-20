const createCluster = require('../action/create-cluster')
const modal = require('../component/modal')

const $trigger = $('#create-cluster')

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
    title: 'Create Cluster'
  })

  $modal
    .modal({
      onApprove: () => {
        const content = $content
          .find('textarea')
          .val()
          .trim()

        const tuples = content.split(/\s+/).map((s) => s.trim())

        createCluster(tuples)
      }
    })
    .modal('show')
})
