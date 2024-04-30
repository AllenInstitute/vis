import React from 'react';
import { SliceViewLayer } from './ui/layer-ui';
import type { Demo } from './demo';

export function AppUi(props: { demo: Demo }) {
  return <SliceViewLayer demo={props.demo} />;
}
