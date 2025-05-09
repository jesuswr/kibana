/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import expect from '@kbn/expect';
import hjson from 'hjson';
import { FtrService } from '../ftr_provider_context';

const compareSpecs = (first: string, second: string) => {
  const normalizeSpec = (spec: string) => spec.replace(/[\n ]/g, '');
  return normalizeSpec(first) === normalizeSpec(second);
};

export class VegaChartPageObject extends FtrService {
  private readonly find = this.ctx.getService('find');
  private readonly testSubjects = this.ctx.getService('testSubjects');
  private readonly retry = this.ctx.getService('retry');
  private readonly monacoEditor = this.ctx.getService('monacoEditor');

  public getEditor() {
    return this.testSubjects.find('vega-editor');
  }

  public getViewContainer() {
    return this.find.byCssSelector('div.vgaVis__view');
  }

  public getControlContainer() {
    return this.find.byCssSelector('div.vgaVis__controls');
  }

  public getYAxisContainer() {
    return this.find.byCssSelector('[aria-label^="Y-axis"]');
  }

  public async getSpec() {
    return this.monacoEditor.getCodeEditorValue();
  }

  public async fillSpec(newSpec: string) {
    await this.retry.try(async () => {
      await this.cleanSpec();
      await this.monacoEditor.setCodeEditorValue(newSpec);

      expect(compareSpecs(await this.getSpec(), newSpec)).to.be(true);
    });
  }

  public async getSpecAsJSON() {
    const text = await this.monacoEditor.getCodeEditorValue();
    try {
      const spec = hjson.parse(text, { legacyRoot: false, keepWsc: true });
      return {
        spec,
        isValid: true,
      };
    } catch (err) {
      return { spec: text, isValid: false };
    }
  }

  public async cleanSpec() {
    await this.monacoEditor.setCodeEditorValue('');
  }

  public async getYAxisLabels() {
    const yAxis = await this.getYAxisContainer();
    const tickGroup = await yAxis.findByClassName('role-axis-label');
    const labels = await tickGroup.findAllByCssSelector('text');
    const labelTexts: string[] = [];

    for (const label of labels) {
      labelTexts.push(await label.getVisibleText());
    }
    return labelTexts;
  }
}
