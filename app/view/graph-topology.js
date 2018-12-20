const EventEmitter = require('events')

module.exports = class GraphTopology extends EventEmitter {
  constructor (opt) {
    super()

    this.clusterLinks = []
    this.clusterNodes = []

    const { height, width } = opt
    this.height = height
    this.width = width

    const colors = d3.scaleOrdinal(d3.schemeCategory10)
    this.colors = colors

    const { id } = opt
    const svg = d3
      .select(id)
      .append('svg')
      .attr('style', 'display: block')
      .attr('oncontextmenu', 'return false;')
      .attr('height', this.height)
      .attr('width', this.width)

    // define arrow markers for graph links
    svg
      .append('svg:defs')
      .append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 6)
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#000')

    svg
      .append('svg:defs')
      .append('svg:marker')
      .attr('id', 'start-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 4)
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M10,-5L0,0L10,5')
      .attr('fill', '#000')

    this.svg = svg

    // init D3 force layout
    const force = d3
      .forceSimulation()
      .force(
        'link',
        d3
          .forceLink()
          .id((v) => v.id)
          .distance(150)
      )
      .force('charge', d3.forceManyBody().strength(-500))
      .force('x', d3.forceX().x(() => this.width / 2))
      .force('y', d3.forceY().y((v) => (v.isMaster ? this.height / 3 : this.height - 100)))
      // update force layout (called automatically each iteration)
      .on('tick', () => {
        this.circle.attr('transform', (v) => `translate(${v.x},${v.y})`)

        // draw directed edges with proper padding from node centers
        this.path.attr('d', (v) => {
          const deltaX = v.target.x - v.source.x
          const deltaY = v.target.y - v.source.y

          const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

          const normX = deltaX / dist
          const normY = deltaY / dist
          const sourcePadding = v.left ? 17 : 12
          const targetPadding = v.right ? 17 : 12

          const sourceX = v.source.x + sourcePadding * normX
          const sourceY = v.source.y + sourcePadding * normY
          const targetX = v.target.x - targetPadding * normX
          const targetY = v.target.y - targetPadding * normY

          return `M${sourceX},${sourceY}L${targetX},${targetY}`
        })
      })

    this.force = force

    // init D3 drag support
    const drag = d3
      .drag()
      .on('start', (v) => {
        if (!d3.event.active) force.alphaTarget(0.3).restart()
        v.fx = v.x
        v.fy = v.y
      })
      .on('drag', (v) => {
        v.fx = d3.event.x
        v.fy = d3.event.y
      })
      .on('end', (v) => {
        if (!d3.event.active) force.alphaTarget(0)
        v.fx = null
        v.fy = null
      })

    this.drag = drag

    // line displayed when dragging new nodes
    const dragLine = svg
      .append('svg:path')
      .attr('class', 'link dragline hidden')
      .attr('d', 'M0,0L0,0')

    this.dragLine = dragLine

    // handles to link and node element groups
    const circle = svg.append('svg:g').selectAll('g')
    this.circle = circle

    const path = svg.append('svg:g').selectAll('path')
    this.path = path

    this.keyCode = -1
    this.mdClusterLink = null
    this.mdClusterNode = null
    this.muClusterNode = null
    this.sClusterLink = null
    this.sClusterNode = null

    this.resize = this.resize.bind(this)
    this.update = this.update.bind(this)

    this._handleKeyDown = this._handleKeyDown.bind(this)
    this._handleKeyUp = this._handleKeyUp.bind(this)
    this._handleMouseMove = this._handleMouseMove.bind(this)
    this._handleMouseUp = this._handleMouseUp.bind(this)
    this._render = this._render.bind(this)

    svg
      .on('mousemove', this._handleMouseMove)
      .on('mouseup', this._handleMouseUp)

    d3.select(window)
      .on('keydown', this._handleKeyDown)
      .on('keyup', this._handleKeyUp)
  }

  resize (height, width) {
    this.svg.attr('height', height).attr('width', width)

    this.height = height
    this.width = width
  }

  update (clusterNodes, clusterLinks) {
    this.clusterNodes = clusterNodes
    this.clusterLinks = clusterLinks
    this._render()
  }

  _handleKeyDown () {
    if (this.keyCode !== -1) return
    this.keyCode = d3.event.keyCode

    // ctrl
    if (d3.event.keyCode === 17) {
      this.circle.call(this.drag)
      this.svg.classed('ctrl', true)
    }

    if (!this.sClusterNode && !this.sClusterLink) return

    switch (d3.event.keyCode) {
      case 8: // backspace
      case 46: // delete
        if (this.sClusterNode) {
          this.clusterNodes.splice(this.clusterNodes.indexOf(this.sClusterNode), 1)
          const toSplice = this.clusterLinks.filter((v) => v.source === this.sClusterNode || v.target === this.sClusterNode)
          for (const v of toSplice) {
            this.clusterLinks.splice(this.clusterLinks.indexOf(v), 1)
          }
        } else if (this.sClusterLink) {
          this.clusterLinks.splice(this.clusterLinks.indexOf(this.sClusterLink), 1)
        }

        this.sClusterLink = null
        this.sClusterNode = null

        this._render()

        break

      case 66: // B
        if (this.sClusterLink) {
          // set link direction to both left and right
          this.sClusterLink.left = true
          this.sClusterLink.right = true
        }

        this._render()

        break

      case 76: // L
        if (this.sClusterLink) {
          // set link direction to left only
          this.sClusterLink.left = true
          this.sClusterLink.right = false
        }

        this._render()

        break

      case 82: // R
        if (this.sClusterNode) {
          // toggle node reflexivity
          this.sClusterNode.isMaster = !this.sClusterNode.isMaster
        } else if (this.sClusterLink) {
          // set link direction to right only
          this.sClusterLink.left = false
          this.sClusterLink.right = true
        }

        this._render()

        break
    }
  }

  _handleKeyUp () {
    this.keyCode = -1

    // ctrl
    if (d3.event.keyCode === 17) {
      this.circle.on('.drag', null)
      this.svg.classed('ctrl', false)
    }
  }

  _handleMouseMove () {
    if (!this.mdClusterNode) return

    // update drag line
    const mouse = d3.mouse(this.svg.node())
    this.dragLine.attr('d', `M${this.mdClusterNode.x},${this.mdClusterNode.y}L${mouse[0]},${mouse[1]}`)

    this._render()
  }

  _handleMouseUp () {
    if (this.mdClusterNode) {
      // hide drag line
      this.dragLine.classed('hidden', true).style('marker-end', '')
    }

    // because :active only works in WebKit?
    this.svg.classed('active', false)

    // clear mouse event vars
    this._resetMouse()
  }

  _resetMouse () {
    this.mdClusterLink = null
    this.mdClusterNode = null
    this.muClusterNode = null
  }

  // update graph (called when needed)
  _render () {
    // path (link) group
    this.path = this.path.data(this.clusterLinks)

    // update existing links
    this.path
      .classed('selected', (v) => v === this.sClusterLink)
      .style('marker-start', (v) => (v.left ? 'url(#start-arrow)' : ''))
      .style('marker-end', (v) => (v.right ? 'url(#end-arrow)' : ''))

    // remove old links
    this.path.exit().remove()

    // add new links
    this.path = this.path
      .enter()
      .append('svg:path')
      .attr('class', 'link')
      .classed('selected', (v) => v === this.sClusterLink)
      .style('marker-start', (v) => (v.left ? 'url(#start-arrow)' : ''))
      .style('marker-end', (v) => (v.right ? 'url(#end-arrow)' : ''))
      .on('mousedown', (v) => {
        if (d3.event.ctrlKey) return

        // select link
        this.mdClusterLink = v
        this.sClusterLink = this.mdClusterLink === this.sClusterLink ? null : this.mdClusterLink
        this.sClusterNode = null
        this._render()
      })
      .merge(this.path)

    // circle (node) group
    // NB: the function arg is crucial here! nodes are known by id, not by index!
    this.circle = this.circle.data(this.clusterNodes, (v) => v.id)

    // update existing nodes (reflexive & selected visual states)
    this.circle
      .selectAll('circle')
      .attr('data-id', (v) => v.id)
      .style('fill', (v) =>
        v === this.sClusterNode
          ? d3
            .rgb(this.colors(v.isMaster))
            .brighter()
            .toString()
          : this.colors(v.isMaster)
      )
      .classed('reflexive', (v) => v.isMaster)
      .on('click', (v) => {
        this.emit('click', v)
      })

    // remove old nodes
    this.circle.exit().remove()

    // add new nodes
    const graph = this.circle.enter().append('svg:g')

    graph
      .append('svg:circle')
      .attr('class', 'node')
      .attr('r', 12)
      .style('fill', (v) =>
        v === this.sClusterNode
          ? d3
            .rgb(this.colors(v.isMaster))
            .brighter()
            .toString()
          : this.colors(v.isMaster)
      )
      .style('stroke', (v) =>
        d3
          .rgb(this.colors(v.isMaster))
          .darker()
          .toString()
      )
      .classed('reflexive', (v) => v.isMaster)
      .on('mouseover', (v) => {
        if (!this.mdClusterNode || v === this.mdClusterNode) return

        // make target node larger
        graph.attr('transform', 'scale(1.1)')
      })
      .on('mouseout', (v) => {
        if (!this.mdClusterNode || v === this.mdClusterNode) return

        // make target node smaller
        graph.attr('transform', '')
      })
      .on('mousedown', (v) => {
        if (d3.event.ctrlKey) return

        // select node
        this.mdClusterNode = v
        this.sClusterNode = this.mdClusterNode === this.sClusterNode ? null : this.mdClusterNode
        this.sClusterLink = null

        // reposition drag line
        this.dragLine
          .style('marker-end', 'url(#end-arrow)')
          .classed('hidden', false)
          .attr('d', `M${this.mdClusterNode.x},${this.mdClusterNode.y}L${this.mdClusterNode.x},${this.mdClusterNode.y}`)

        this._render()
      })
      .on('mouseup', (v) => {
        if (!this.mdClusterNode) return

        // needed by FF
        this.dragLine.classed('hidden', true).style('marker-end', '')

        // check for drag-to-self
        this.muClusterNode = v
        if (this.muClusterNode === this.mdClusterNode) {
          this._resetMouse()
          return
        }

        // unenlarge target node
        graph.attr('transform', '')

        // add link to graph (update if exists)
        // NB: links are strictly source < target; arrows separately specified by booleans
        const isRight = this.mdClusterNode.id < this.muClusterNode.id
        const source = isRight ? this.mdClusterNode : this.muClusterNode
        const target = isRight ? this.muClusterNode : this.mdClusterNode

        const clusterLink = this.clusterLinks.filter((v) => v.source === source && v.target === target)[0]
        if (clusterLink) {
          clusterLink[isRight ? 'right' : 'left'] = true
        } else {
          // links.push({ source, target, left: !isRight, right: isRight })
          this.emit('link', this.mdClusterNode, this.muClusterNode)
        }

        // select new link
        this.sClusterLink = this.clusterLink
        this.sClusterNode = null
        this._render()
      })

    // show node IDs
    graph
      .append('svg:text')
      .attr('x', 0)
      .attr('y', (v) => (v.isMaster ? -35 : 30))
      .attr('class', 'id')
      .text((v) => v.tuple)

    // show node slots
    graph
      .append('svg:text')
      .attr('x', 0)
      .attr('y', (v) => (v.isMaster ? -20 : 30))
      .attr('class', 'slots')
      .text((v) => v.slots)

    // update node slots
    this.circle.selectAll('text.slots').text((v) => v.slots)

    this.circle = graph.merge(this.circle)

    // set the graph in motion
    this.force
      .nodes(this.clusterNodes)
      .force('link')
      .links(this.clusterLinks)

    this.force.alphaTarget(0.3).restart()
  }
}
