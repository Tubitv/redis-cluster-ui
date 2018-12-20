const EventEmitter = require('events')
const fastdom = require('fastdom')

const modal = require('../component/modal')

module.exports = class GraphDiagram extends EventEmitter {
  constructor (opt) {
    super()

    const { redisService, node } = opt

    this.redisService = redisService
    this.node = node

    this.infos = []

    this.memory = null
    this.systemCpu = null
    this.userCpu = null

    this._createDiagram = this._createDiagram.bind(this)
    this._destroy = this._destroy.bind(this)
    this.create = this.create.bind(this)
  }

  create () {
    const { tuple } = this.node

    const $content = $(`<div class="graph-diagram-content" />`)

    const $modal = modal.create({
      action: '',
      body: $content,
      className: 'longer',
      title: `${tuple}`
    })

    let measure
    let mutate
    let width = 0

    $modal
      .modal({
        onHide: () => {
          if (measure) fastdom.clear(measure)
          if (mutate) fastdom.clear(mutate)
          this._destroy()
        },
        onShow: () => {
          this._runScheduler()

          measure = fastdom.measure(() => {
            width = $content.width()
          })

          mutate = fastdom.mutate(() => {
            this.systemCpu = this._createDiagram({
              $content: $content,
              data: [],
              dataKey: 'used_cpu_sys',
              height: width / 2,
              offset: 50,
              title: 'System CPU',
              width: width
            })

            this.userCpu = this._createDiagram({
              $content: $content,
              data: [],
              dataKey: 'used_cpu_user',
              height: width / 2,
              offset: 50,
              title: 'User CPU',
              width: width
            })

            this.memory = this._createDiagram({
              $content: $content,
              data: [],
              dataKey: 'used_memory',
              dataTransform: (v) => v / 1024,
              height: width / 2,
              offset: 50,
              title: 'Memory',
              width: width
            })
          })
        }
      })
      .modal('show')
  }

  _runScheduler () {
    this.interval = setInterval(async () => {
      await this._readFromRedisService()
      this._update()
    }, 1000)
  }

  _destroy () {
    if (this.interval) {
      clearInterval(this.interval)
      delete this.interval
    }

    delete this.infos
    delete this.memory
    delete this.node
    delete this.redisService
    delete this.systemCpu
    delete this.userCpu
  }

  _update () {
    if (this.memory) this.memory.update({ data: this.infos })
    if (this.systemCpu) this.systemCpu.update({ data: this.infos })
    if (this.userCpu) this.userCpu.update({ data: this.infos })
  }

  _createDiagram (opt) {
    const { $content, data, dataKey, dataTransform, height, offset, title, width } = opt

    const getValue = (v) => {
      return dataTransform ? dataTransform(v.value[dataKey]) : v.value[dataKey]
    }

    const $container = $('<div />')
    $content.append($container)

    const container = $container.get(0)

    const scaleX = d3.scaleTime().range([0, width - 2 * offset])
    const scaleY = d3.scaleLinear().range([height - 2 * offset, 0])

    const axisX = d3.axisBottom(scaleX).ticks(5)
    const axisY = d3.axisLeft(scaleY).ticks(5)

    const lineValue = d3
      .line()
      .x((v) => scaleX(v.date))
      .y((v) => scaleY(getValue(v)))

    scaleX.domain(d3.extent(data, (v) => v.date))
    scaleY.domain([0, d3.max(data, (v) => getValue(v) * 2)])

    const svg = d3
      .select(container)
      .append('svg')
      .attr('class', 'diagram')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${offset}, ${offset})`)

    if (title) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text(title)
    }

    svg
      .append('path')
      .attr('class', 'line')
      .attr('d', lineValue(data))
    svg
      .append('g')
      .attr('class', 'axis x')
      .attr('transform', `translate(0, ${height - 2 * offset})`)
      .call(axisX)
    svg
      .append('g')
      .attr('class', 'axis y')
      .call(axisY)

    return {
      update: (opt) => {
        const { data } = opt
        scaleX.domain(d3.extent(data, (v) => v.date))
        scaleY.domain([0, d3.max(data, (v) => getValue(v) * 2)])

        const svg = d3.select(container).transition()
        svg
          .select('.line')
          .duration(750)
          .attr('d', lineValue(data))
        svg
          .select('.axis.x')
          .duration(750)
          .call(axisX)
        svg
          .select('.axis.y')
          .duration(750)
          .call(axisY)
      }
    }
  }

  async _readFromRedisService () {
    const { tuple } = this.node

    if (this.redisService) {
      const transform = (info) => {
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

      const date = new Date()
      let value = await this.redisService.readClusterNodeInfo(tuple)
      value = transform(value)

      this.infos.push({ date, value })
    }
  }
}
