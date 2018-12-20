exports.create = (opt) => {
  const { action, body, className, title } = opt

  const $modal = $(`
    <div class="ui modal">
      <div class="header" />
      <div class="content scrolling" />
      <div class="actions" />
    </div>
  `)

  $modal.addClass(className)

  $modal.find('.actions').append(
    action != null
      ? action
      : `
    <button class="ui black deny button" type="button">Cancel</button>
    <button class="ui positive right button" type="button">OK</button>
  `
  )

  $modal.find('.header').append(title)
  $modal.find('.content').append(body)

  return $modal
}
