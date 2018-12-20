const rebalance = require('../action/rebalance')

const $trigger = $('#rebalance')

$trigger.click(() => {
  const confirm = window.confirm('Do you really want to rebalance slots and use empty masters?')
  if (confirm) rebalance()
})
