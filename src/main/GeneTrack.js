/**
 * Visualization of genes, including exons and coding regions.
 * @flow
 */
'use strict';

import type {Strand} from './Alignment';
import type {Gene, BigBedSource} from './BigBedDataSource';
import type {VizProps} from './VisualizationWrapper';

var React = require('react'),
    ReactDOM = require('react-dom'),
    _ = require('underscore'),
    shallowEquals = require('shallow-equals');

var bedtools = require('./bedtools'),
    Interval = require('./Interval'),
    d3utils = require('./d3utils'),
    scale = require('./scale'),
    ContigInterval = require('./ContigInterval'),
    canvasUtils = require('./canvas-utils'),
    dataCanvas = require('data-canvas'),
    style = require('./style');


// Draw an arrow in the middle of the visible portion of range.
// TODO: right-facing arrows!
function drawArrow(ctx: CanvasRenderingContext2D,
                   clampedScale: (x: number)=>number,
                   range: Interval,
                   tipY: number,
                   strand: Strand) {
  var x1 = clampedScale(range.start),
      x2 = clampedScale(range.stop);

  // it's off-screen or there's not enough room to draw it legibly.
  if (x2 - x1 <= 2 * style.GENE_ARROW_SIZE) return;

  var cx = (x1 + x2) / 2;
  ctx.beginPath();
  if (strand == '-') {
    ctx.moveTo(cx + style.GENE_ARROW_SIZE, tipY - style.GENE_ARROW_SIZE);
    ctx.lineTo(cx, tipY);
    ctx.lineTo(cx + style.GENE_ARROW_SIZE, tipY + style.GENE_ARROW_SIZE);
  } else {
    ctx.moveTo(cx - style.GENE_ARROW_SIZE, tipY - style.GENE_ARROW_SIZE);
    ctx.lineTo(cx, tipY);
    ctx.lineTo(cx - style.GENE_ARROW_SIZE, tipY + style.GENE_ARROW_SIZE);
  }
  ctx.stroke();
}

function drawGeneName(ctx: CanvasRenderingContext2D,
                      clampedScale: (x: number)=>number,
                      geneLineY: number,
                      gene: Gene,
                      textIntervals: Interval[]) {
  var p = gene.position,
      centerX = 0.5 * (clampedScale(p.start()) + clampedScale(p.stop()));
  var name = gene.name || gene.id;
  var textWidth = ctx.measureText(name).width;
  var textInterval = new Interval(centerX - 0.5 * textWidth,
                                  centerX + 0.5 * textWidth);
  if (!_.any(textIntervals, iv => textInterval.intersects(iv))) {
    textIntervals.push(textInterval);
    var baselineY = geneLineY + style.GENE_FONT_SIZE + style.GENE_TEXT_PADDING;
    ctx.fillText(name, centerX, baselineY);
  }
}

class GeneTrack extends React.Component {
  props: VizProps & { source: BigBedSource };
  state: {genes: Gene[]};

  constructor(props: VizProps) {
    super(props);
    this.state = {
      genes: []
    };
  }

  render(): any {
    return <canvas />;
  }

  componentDidMount() {
    // Visualize new reference data as it comes in from the network.
    this.props.source.on('newdata', () => {
      var range = this.props.range,
          ci = new ContigInterval(range.contig, range.start, range.stop);
      this.setState({
        genes: this.props.source.getGenesInRange(ci)
      });
    });

    this.updateVisualization();
  }

  getScale() {
    return d3utils.getTrackScale(this.props.range, this.props.width);
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    if (!shallowEquals(prevProps, this.props) ||
        !shallowEquals(prevState, this.state)) {
      this.updateVisualization();
    }
  }

  updateVisualization() {
    var canvas = ReactDOM.findDOMNode(this),
        {width, height} = this.props,
        genomeRange = this.props.range;

    var range = new ContigInterval(genomeRange.contig, genomeRange.start, genomeRange.stop);

    // Hold off until height & width are known.
    if (width === 0) return;

    var sc = this.getScale(),
        // We can't clamp scale directly because of offsetPx.
        clampedScale = scale.linear()
            .domain([sc.invert(0), sc.invert(width)])
            .range([0, width])
            .clamp(true);

    d3utils.sizeCanvas(canvas, width, height);

    var ctx = dataCanvas.getDataContext(canvasUtils.getContext(canvas));
    ctx.reset();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    var geneLineY = Math.round(height / 4);
    var textIntervals = [];  // x-intervals with rendered gene names, to avoid over-drawing.
    // TODO: don't pull in genes via state.
    ctx.font = `${style.GENE_FONT_SIZE}px ${style.GENE_FONT}`;
    ctx.textAlign = 'center';
    this.state.genes.forEach(gene => {
      if (!gene.position.chrIntersects(range)) return;
      ctx.pushObject(gene);
      ctx.lineWidth = 1;
      ctx.strokeStyle = style.GENE_COLOR;
      ctx.fillStyle = style.GENE_COLOR;

      canvasUtils.drawLine(ctx, clampedScale(gene.position.start()), geneLineY + 0.5,
                                clampedScale(gene.position.stop()), geneLineY + 0.5);

      // TODO: only compute all these intervals when data becomes available.
      var exons = bedtools.splitCodingExons(gene.exons, gene.codingRegion);
      exons.forEach(exon => {
        ctx.fillRect(sc(exon.start),
                     geneLineY - 3 * (exon.isCoding ? 2 : 1),
                     sc(exon.stop + 1) - sc(exon.start),
                     6 * (exon.isCoding ? 2 : 1));
      });

      var introns = gene.position.interval.complementIntervals(gene.exons);
      introns.forEach(range => {
        drawArrow(ctx, clampedScale, range, geneLineY + 0.5, gene.strand);
      });
      ctx.strokeStyle = style.GENE_COMPLEMENT_COLOR;
      ctx.lineWidth = 2;
      gene.exons.forEach(range => {
        drawArrow(ctx, clampedScale, range, geneLineY + 0.5, gene.strand);
      });

      drawGeneName(ctx, clampedScale, geneLineY, gene, textIntervals);

      ctx.popObject();
    });
  }
}

GeneTrack.displayName = 'genes';

module.exports = GeneTrack;
