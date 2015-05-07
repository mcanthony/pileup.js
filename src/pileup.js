/**
 * This exposes the main entry point into pileup.js.
 * @flow
 */
'use strict';

var _ = require('underscore'),
    React = require('react'),
    // Data sources
    TwoBitDataSource = require('./TwoBitDataSource'),
    BigBedDataSource = require('./BigBedDataSource'),
    VcfDataSource = require('./VcfDataSource'),
    BamDataSource = require('./BamDataSource'),
    // Visualizations
    GenomeTrack = require('./GenomeTrack'),
    GeneTrack = require('./GeneTrack'),
    PileupTrack = require('./PileupTrack'),
    VariantTrack = require('./VariantTrack'),
    Root = require('./Root');

import type {Track, VisualizedTrack} from './types';

type Pileup = {
}

type PileupParams = {
  range: {
    contig: string,
    start: number,
    stop: number
  };
  tracks: Track[];
}

function findReference(tracks: VisualizedTrack[]): ?VisualizedTrack {
  return _.findWhere(tracks, t => t.track.isReference);
}

function create(elOrId: string|Element, params: PileupParams): Pileup {
  var el = typeof(elOrId) == 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) {
    throw new Error(`Attempted to create pileup with non-existent element ${elOrId}`);
  }

  var vizTracks = params.tracks.map(track => ({
    visualization: track.viz,
    source: track.data,
    track
  }));

  var referenceTrack = findReference(vizTracks);
  if (!referenceTrack) {
    throw new Error('You must include at least one track with type=reference');
  }

  return React.render(<Root referenceSource={referenceTrack.source}
                            tracks={vizTracks}
                            initialRange={params.range} />, el);
}

module.exports = {
  create,
  formats: {
    bam: BamDataSource.create,
    vcf: VcfDataSource.create,
    twoBit: TwoBitDataSource.create,
    bigBed: BigBedDataSource.create
  },
  viz: {
    genome: () => GenomeTrack,
    genes: () => GeneTrack,
    variants: () => VariantTrack,
    pileup: () => PileupTrack
  }
};