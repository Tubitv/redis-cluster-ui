const addNode = require('../action/add-node')
const modal = require('../component/modal')

const $trigger = $('#add-node')

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
    title: 'Add Node'
  })

  $modal
    .modal({
      onApprove: () => {
        const content = $content
          .find('textarea')
          .val()
          .trim()

        addNode(content)
      }
    })
    .modal('show')
})
