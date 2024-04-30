import React from 'react';
import { SliceViewLayer } from './ui/slice-ui';
import type { Demo } from './demo';
import { AnnotationGrid } from './ui/annotation-grid';
import { ContactSheetUI } from './ui/contact-sheet';
import { ScatterplotUI } from './ui/scatterplot-ui';

export function AppUi(props: { demo: Demo }) {
  const {demo}=props;
  const layer = demo.layers[demo.selectedLayer];
  if(layer){
    switch(layer.type){
      case 'annotationGrid':
        return <AnnotationGrid demo={demo}/>
      case 'volumeGrid':
        return <ContactSheetUI demo={demo}/>
      case 'volumeSlice':
        return <SliceViewLayer demo={demo}/>
      case 'scatterplot':
      case 'scatterplotGrid':
        return <ScatterplotUI demo={demo}/>
      default:
        return null;
    }
  }
  return <SliceViewLayer demo={props.demo} />;
}
