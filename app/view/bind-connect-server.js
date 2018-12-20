const { remote } = require('electron')
const { os } = require('os')

const connectServer = require('../action/connect-server')
const modal = require('../component/modal')

const $trigger = $('#connect-server')

const getContent = () => $(`
  <div class="description">
    <form class="ui large form">
      <div class="ui stacked segment">
        <div class="field">
          <div class="ui left icon input">
            <i class="desktop icon"></i>
            <input type="text" name="host" placeholder="Host" />
          </div>
        </div>
        <div class="field">
          <div class="ui left icon input">
            <i class="user icon"></i>
            <input type="text" name="user" placeholder="User" />
          </div>
        </div>
        <div class="field">
          <div class="ui left icon input">
            <i class="key icon"></i>
            <input type="text" name="key" placeholder="SSH Key" />
            <i class="folder open link icon" style="left: auto; right: .5em"></i>
          </div>
        </div>
        <div class="field">
          <div class="ui left icon input">
            <i class="plug icon"></i>
            <input type="text" name="port" placeholder="SSH Port" value="22" />
          </div>
        </div>
      </div>
      <div class="ui error message"></div>
    </form>
  </div>
`)

$trigger.click(() => {
  const $content = getContent()

  $content.find('.folder.open.icon').click(() => {
    remote.dialog.showOpenDialog(
      {
        title: 'Select SSH private key',
        defaultPath: `${os.homedir()}/.ssh`,
        properties: ['openFile', 'showHiddenFiles']
      },
      (filePaths) => {
        if (filePaths && filePaths[0]) {
          $content.find('input[name="key"]').val(filePaths[0])
        }
      }
    )
  })

  const $modal = modal.create({
    body: $content,
    title: 'Connect to Remote Server'
  })

  $modal.modal('show').modal({
    onApprove: () => {
      const [host, user, key, port] = $content
        .find('input')
        .map(() => this.value)
        .get()

      connectServer(host, port, user, null, key)
    }
  })
})
