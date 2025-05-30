/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import expect from '@kbn/expect';
import { FtrService } from '../ftr_provider_context';
export class SettingsPageObject extends FtrService {
  private readonly log = this.ctx.getService('log');
  private readonly retry = this.ctx.getService('retry');
  private readonly browser = this.ctx.getService('browser');
  private readonly find = this.ctx.getService('find');
  private readonly flyout = this.ctx.getService('flyout');
  private readonly testSubjects = this.ctx.getService('testSubjects');
  private readonly comboBox = this.ctx.getService('comboBox');
  private readonly header = this.ctx.getPageObject('header');
  private readonly common = this.ctx.getPageObject('common');
  private readonly savedObjects = this.ctx.getPageObject('savedObjects');
  private readonly monacoEditor = this.ctx.getService('monacoEditor');

  async clickLinkText(text: string) {
    await this.find.clickByDisplayedLinkText(text);
  }

  async clickKibanaSettings() {
    await this.testSubjects.click('settings');
    await this.header.waitUntilLoadingHasFinished();
    await this.testSubjects.existOrFail('managementSettingsTitle');
  }

  async clickKibanaGlobalSettings() {
    await this.testSubjects.click('settings');
    await this.header.waitUntilLoadingHasFinished();
    await this.testSubjects.click('settings-tab-global-settings');
  }

  async clickKibanaSavedObjects() {
    await this.testSubjects.click('objects');
    await this.savedObjects.waitTableIsLoaded();
  }

  async clickKibanaIndexPatterns() {
    this.log.debug('clickKibanaDataViews link');
    const currentUrl = await this.browser.getCurrentUrl();
    if (!currentUrl.endsWith('dataViews')) {
      await this.testSubjects.click('dataViews');
    }

    await this.header.waitUntilLoadingHasFinished();
  }

  async clickSnapshotRestore() {
    await this.testSubjects.click('snapshot_restore');
    await this.header.waitUntilLoadingHasFinished();
    await this.retry.waitFor('snapshot restore header to be visible', async () => {
      return (await this.testSubjects.getVisibleText('appTitle')) === 'Snapshot and Restore';
    });
  }

  async clickIndexManagement() {
    await this.testSubjects.click('index_management');
    await this.header.waitUntilLoadingHasFinished();
  }

  async getAdvancedSettings(propertyName: string) {
    this.log.debug('in getAdvancedSettings');
    return await this.testSubjects.getAttribute(
      `management-settings-editField-${propertyName}`,
      'value'
    );
  }

  async expectDisabledAdvancedSetting(propertyName: string) {
    expect(
      await this.testSubjects.getAttribute(
        `management-settings-editField-${propertyName}`,
        'disabled'
      )
    ).to.eql('true');
  }

  async getAdvancedSettingCheckbox(propertyName: string) {
    this.log.debug('in getAdvancedSettingCheckbox');
    return await this.testSubjects.getAttribute(
      `management-settings-editField-${propertyName}`,
      'checked'
    );
  }

  async getAdvancedSettingAriaCheckbox(propertyName: string) {
    this.log.debug('in getAdvancedSettingAriaCheckbox');
    return await this.testSubjects.getAttribute(
      `management-settings-editField-${propertyName}`,
      'aria-checked'
    );
  }

  async clearAdvancedSettings(propertyName: string) {
    await this.testSubjects.click(`management-settings-resetField-${propertyName}`);
    await this.header.waitUntilLoadingHasFinished();
    await this.testSubjects.click(`settings-save-button`);
    await this.header.waitUntilLoadingHasFinished();
  }

  async setAdvancedSettingsSelect(propertyName: string, propertyValue: string) {
    await this.find.clickByCssSelector(
      `[data-test-subj="management-settings-editField-${propertyName}"] option[value="${propertyValue}"]`
    );
    await this.header.waitUntilLoadingHasFinished();
    await this.testSubjects.click(`settings-save-button`);
    await this.header.waitUntilLoadingHasFinished();
  }

  async setAdvancedSettingsInput(propertyName: string, propertyValue: string) {
    const input = await this.testSubjects.find(`management-settings-editField-${propertyName}`);
    await input.clearValue();
    await input.type(propertyValue);
    await this.testSubjects.click(`settings-save-button`);
    await this.header.waitUntilLoadingHasFinished();
  }

  async setAdvancedSettingsImage(propertyName: string, path: string) {
    const input = await this.testSubjects.find(`management-settings-editField-${propertyName}`);
    await input.type(path);
    await this.testSubjects.click(`settings-save-button`);
    await this.header.waitUntilLoadingHasFinished();
  }

  async toggleAdvancedSettingCheckbox(propertyName: string, value?: boolean) {
    let curValue: string | null;
    if (value !== undefined) {
      curValue = await this.getAdvancedSettingAriaCheckbox(propertyName);

      if (curValue === (value ? 'true' : 'false')) return;
    }

    await this.testSubjects.click(`management-settings-editField-${propertyName}`);
    await this.header.waitUntilLoadingHasFinished();
    await this.testSubjects.click(`settings-save-button`);
    await this.header.waitUntilLoadingHasFinished();
  }

  async navigateTo() {
    await this.common.navigateToApp('settings');
  }

  async getIndexPatternField() {
    return this.testSubjects.find('createIndexPatternTitleInput');
  }

  async getTimeFieldNameField() {
    const wrapperElement = await this.testSubjects.find('timestampField');
    return wrapperElement.findByTestSubject('comboBoxSearchInput');
  }

  noTimeFieldOption = "--- I don't want to use the time filter ---";

  async selectTimeFieldOption(selection: string) {
    const testSubj = 'timestampField';
    const timefield = await this.testSubjects.find(testSubj);

    await this.retry.waitFor('loading the timefield options should be finished', async () => {
      const isLoading = await timefield.getAttribute('data-is-loading');
      return isLoading === '0';
    });
    const isEnabled = await (await timefield.findByTestSubject('comboBoxSearchInput')).isEnabled();
    if (!isEnabled) {
      return;
    }
    const isSelected = await this.comboBox.isOptionSelected(timefield, selection);
    if (isSelected) {
      return;
    }
    await this.retry.waitFor('time field dropdown have the right value', async () => {
      await this.comboBox.set(testSubj, selection);
      return await this.comboBox.isOptionSelected(timefield, selection);
    });
  }

  async getNameField() {
    return this.testSubjects.find('createIndexPatternNameInput');
  }

  async setNameField(dataViewName: string) {
    const field = await this.getNameField();
    await field.clearValueWithKeyboard();
    await field.type(dataViewName);
  }

  async getSaveIndexPatternButton() {
    return await this.testSubjects.find('saveIndexPatternButton');
  }

  async getSaveDataViewButtonActive() {
    await this.retry.waitFor('active save button', async () => {
      return (
        (
          await this.find.allByCssSelector(
            '[data-test-subj="saveIndexPatternButton"]:not(.euiButton-isDisabled)'
          )
        ).length === 1
      );
    });
    return await this.testSubjects.find('saveIndexPatternButton');
  }

  async clickEditIndexButton() {
    await this.testSubjects.click('editIndexPatternButton');
    await this.retry.waitFor('flyout', async () => {
      return await this.testSubjects.exists('indexPatternEditorFlyout');
    });
  }

  async clickDeletePattern() {
    await this.testSubjects.click('deleteIndexPatternButton');
  }

  async getIndexPageHeading() {
    return await this.testSubjects.getVisibleText('indexPatternTitle');
  }

  async getTableHeader() {
    return await this.find.allByCssSelector('table.euiTable thead tr th');
  }

  async sortBy(columnName: string) {
    const chartTypes = await this.find.allByCssSelector('table.euiTable thead tr th button');

    const getChartType = async (chart: Record<string, any>) => {
      const chartString = await chart.getVisibleText();
      if (chartString === columnName) {
        await chart.click();
        await this.header.waitUntilLoadingHasFinished();
      }
    };

    const getChartTypesPromises = chartTypes.map(getChartType);
    return Promise.all(getChartTypesPromises);
  }

  async getTableRow(rowNumber: number, colNumber: number) {
    // passing in zero-based index, but adding 1 for css 1-based indexes
    return await this.find.byCssSelector(
      'table.euiTable tbody tr:nth-child(' +
        (rowNumber + 1) +
        ') td.euiTableRowCell:nth-child(' +
        (colNumber + 1) +
        ')'
    );
  }

  async getFieldsTabCount() {
    return this.retry.try(async () => {
      // We extract the text from the tab (something like "Fields (86)")
      const text = await this.testSubjects.getVisibleText('tab-indexedFields');
      // And we return the number inside the parenthesis "86"
      return text.split(' ')[1].replace(/\((.*)\)/, '$1');
    });
  }

  async getScriptedFieldsTabCount() {
    try {
      const text = await this.testSubjects.getVisibleText('tab-scriptedFields');
      return text.split(' ')[2].replace(/\((.*)\)/, '$1') || '0';
    } catch (e) {
      return '0';
    }
  }

  async getRelationshipsTabCount() {
    return await this.retry.try(async () => {
      const text = await this.testSubjects.getVisibleText('tab-relationships');
      return text.split(' ')[1].replace(/\((.*)\)/, '$1');
    });
  }

  async getFieldFilterTabCount() {
    return await this.retry.try(async () => {
      const text = await this.testSubjects.getVisibleText('tab-sourceFilters');
      return text.split(' ')[2].replace(/\((.*)\)/, '$1');
    });
  }

  async getFieldNames() {
    const fieldNameCells = await this.testSubjects.findAll('editIndexPattern > indexedFieldName');
    return await Promise.all(
      fieldNameCells.map(async (cell) => {
        return (await cell.getVisibleText()).trim();
      })
    );
  }

  async getFieldTypes() {
    const fieldNameCells = await this.testSubjects.findAll('editIndexPattern > indexedFieldType');
    return await Promise.all(
      fieldNameCells.map(async (cell) => {
        return (await cell.getVisibleText()).trim();
      })
    );
  }

  async getScriptedFieldLangs() {
    const fieldNameCells = await this.testSubjects.findAll('editIndexPattern > scriptedFieldLang');
    return await Promise.all(
      fieldNameCells.map(async (cell) => {
        return (await cell.getVisibleText()).trim();
      })
    );
  }

  async clearFieldTypeFilter(type: string) {
    await this.retry.try(async () => {
      await this.testSubjects.clickWhenNotDisabledWithoutRetry('indexedFieldTypeFilterDropdown');
      await this.find.byCssSelector(
        '.euiPopover-isOpen[data-test-subj="indexedFieldTypeFilterDropdown-popover"]'
      );
    });
    await this.retry.try(async () => {
      await this.testSubjects.existOrFail(`indexedFieldTypeFilterDropdown-option-${type}-checked`);
    });
    await this.testSubjects.click(`indexedFieldTypeFilterDropdown-option-${type}-checked`);
    await this.testSubjects.existOrFail(`indexedFieldTypeFilterDropdown-option-${type}`);
    await this.browser.pressKeys(this.browser.keys.ESCAPE);
  }

  async setFieldTypeFilter(type: string) {
    await this.retry.try(async () => {
      await this.testSubjects.clickWhenNotDisabledWithoutRetry('indexedFieldTypeFilterDropdown');
      await this.find.byCssSelector(
        '.euiPopover-isOpen[data-test-subj="indexedFieldTypeFilterDropdown-popover"]'
      );
    });
    await this.testSubjects.existOrFail(`indexedFieldTypeFilterDropdown-option-${type}`);
    await this.testSubjects.click(`indexedFieldTypeFilterDropdown-option-${type}`);
    await this.testSubjects.existOrFail(`indexedFieldTypeFilterDropdown-option-${type}-checked`);
    await this.browser.pressKeys(this.browser.keys.ESCAPE);
  }

  async setSchemaFieldTypeFilter(type: string) {
    await this.retry.try(async () => {
      await this.testSubjects.clickWhenNotDisabledWithoutRetry('schemaFieldTypeFilterDropdown');
      await this.find.byCssSelector(
        '.euiPopover-isOpen[data-test-subj="schemaFieldTypeFilterDropdown-popover"]'
      );
    });
    await this.testSubjects.existOrFail(`schemaFieldTypeFilterDropdown-option-${type}`);
    await this.testSubjects.click(`schemaFieldTypeFilterDropdown-option-${type}`);
    await this.testSubjects.existOrFail(`schemaFieldTypeFilterDropdown-option-${type}-checked`);
    await this.browser.pressKeys(this.browser.keys.ESCAPE);
  }

  async clearScriptedFieldLanguageFilter(type: string) {
    await this.testSubjects.clickWhenNotDisabledWithoutRetry('scriptedFieldLanguageFilterDropdown');
    await this.retry.try(async () => {
      await this.testSubjects.existOrFail('scriptedFieldLanguageFilterDropdown-popover');
    });
    await this.retry.try(async () => {
      await this.testSubjects.existOrFail(
        `scriptedFieldLanguageFilterDropdown-option-${type}-checked`
      );
    });
    await this.testSubjects.click(`scriptedFieldLanguageFilterDropdown-option-${type}-checked`);
    await this.testSubjects.existOrFail(`scriptedFieldLanguageFilterDropdown-option-${type}`);
    await this.browser.pressKeys(this.browser.keys.ESCAPE);
  }

  async setScriptedFieldLanguageFilter(language: string) {
    await this.retry.try(async () => {
      await this.testSubjects.clickWhenNotDisabledWithoutRetry(
        'scriptedFieldLanguageFilterDropdown'
      );
      return await this.find.byCssSelector('div.euiPopover__panel[data-popover-open]');
    });
    await this.testSubjects.existOrFail('scriptedFieldLanguageFilterDropdown-popover');
    await this.testSubjects.existOrFail(`scriptedFieldLanguageFilterDropdown-option-${language}`);
    await this.testSubjects.click(`scriptedFieldLanguageFilterDropdown-option-${language}`);
    await this.testSubjects.existOrFail(
      `scriptedFieldLanguageFilterDropdown-option-${language}-checked`
    );
    await this.browser.pressKeys(this.browser.keys.ESCAPE);
  }

  async filterField(name: string) {
    const input = await this.testSubjects.find('indexPatternFieldFilter');
    await input.clearValueWithKeyboard();
    await input.type(name);
    const value = await this.testSubjects.getAttribute('indexPatternFieldFilter', 'value');
    expect(value).to.eql(
      name,
      `Expected new value to be the input: [${name}}], but got: [${value}]`
    );
  }

  async openControlsByName(name: string) {
    await this.filterField(name);
    const tableFields = await (
      await this.find.byCssSelector(
        'table.euiTable tbody tr.euiTableRow td.euiTableRowCell:first-child'
      )
    ).getVisibleText();

    await this.find.clickByCssSelector(
      `table.euiTable tbody tr.euiTableRow:nth-child(${tableFields.indexOf(name) + 1})
        td:nth-last-child(2) button`
    );
    await this.retry.waitFor('flyout to open', async () => {
      return await this.testSubjects.exists('flyoutTitle');
    });
  }

  async setPopularity(value: number) {
    await this.testSubjects.setValue('editorFieldCount', String(value), {
      clearWithKeyboard: true,
    });
  }

  async increasePopularity() {
    await this.setPopularity(Number(await this.getPopularity()) + 1);
  }

  async getPopularity() {
    return await this.testSubjects.getAttribute('editorFieldCount', 'value');
  }

  async controlChangeCancel() {
    await this.testSubjects.click('fieldCancelButton');
    await this.header.waitUntilLoadingHasFinished();
  }

  async controlChangeSave() {
    await this.testSubjects.click('fieldSaveButton');
    await this.header.waitUntilLoadingHasFinished();
  }

  async clickIndexPatternByName(name: string) {
    const indexLink = await this.find.byXPath(`//a[text()='${name}']`);
    await indexLink.click();
  }

  async clickIndexPatternLogstash() {
    await this.clickIndexPatternByName('logstash-*');
  }

  async getIndexPatternList() {
    await this.testSubjects.existOrFail('indexPatternTable', { timeout: 5000 });
    return await this.find.allByCssSelector(
      '[data-test-subj="indexPatternTable"] .euiTable .euiTableRow'
    );
  }

  async getAllIndexPatternNames() {
    const indexPatterns = await this.getIndexPatternList();
    return await Promise.all(
      indexPatterns.map(async (index) => {
        return await index.getVisibleText();
      })
    );
  }

  async isIndexPatternListEmpty() {
    return !(await this.testSubjects.exists('indexPatternTable', { timeout: 5000 }));
  }

  async removeLogstashIndexPatternIfExist() {
    if (!(await this.isIndexPatternListEmpty())) {
      await this.clickIndexPatternLogstash();
      await this.removeIndexPattern();
    }
  }

  async addCustomDataViewId(value: string) {
    await this.testSubjects.click('toggleAdvancedSetting');
    const customDataViewIdInput = await (
      await this.testSubjects.find('savedObjectIdField')
    ).findByTagName('input');
    await customDataViewIdInput.type(value);
  }

  async refreshDataViewFieldList(
    dataViewName?: string,
    options: { ignoreMissing?: boolean } = { ignoreMissing: false }
  ) {
    if (dataViewName) {
      await this.common.navigateToApp('management/kibana/dataViews');
      await this.header.waitUntilLoadingHasFinished();
      if (
        options.ignoreMissing &&
        !(await this.testSubjects.exists(`detail-link-${dataViewName}`))
      ) {
        return;
      }
      await this.testSubjects.click(`detail-link-${dataViewName}`);
    }
    await this.testSubjects.click('refreshDataViewButton');

    // wait for refresh to start
    await new Promise((r) => setTimeout(r, 500));

    // wait for refresh to finish
    await this.retry.try(async () => {
      const btn = await this.testSubjects.find('refreshDataViewButton');
      const disabled = await btn.getAttribute('disabled');
      expect(disabled).to.be(null);
    });
  }

  async allowHiddenClick() {
    await this.testSubjects.click('toggleAdvancedSetting');
    const allowHiddenField = await this.testSubjects.find('allowHiddenField');
    await (await allowHiddenField.findByTagName('button')).click();
  }

  async createIndexPattern(
    indexPatternName: string,
    // null to bypass default value
    timefield: string | null = '@timestamp',
    isStandardIndexPattern = true,
    customDataViewId?: string,
    dataViewName?: string,
    allowHidden?: boolean
  ) {
    await this.retry.try(async () => {
      await this.header.waitUntilLoadingHasFinished();
      await this.clickKibanaIndexPatterns();

      await this.header.waitUntilLoadingHasFinished();
      const flyOut = await this.testSubjects.exists('createAnyway');
      if (flyOut) {
        await this.testSubjects.click('createAnyway');
      } else {
        await this.clickAddNewIndexPatternButton();
      }

      if (allowHidden) {
        await this.allowHiddenClick();
      }

      await this.header.waitUntilLoadingHasFinished();
      if (!isStandardIndexPattern) {
        await this.selectRollupIndexPatternType();
      }
      await this.retry.try(async () => {
        await this.setIndexPatternField(indexPatternName);
      });

      if (timefield) {
        await this.selectTimeFieldOption(timefield);
      }
      if (customDataViewId) {
        await this.addCustomDataViewId(customDataViewId);
      }
      if (dataViewName) {
        await this.setNameField(dataViewName);
      }
      await (await this.getSaveIndexPatternButton()).click();
    });
    await this.header.waitUntilLoadingHasFinished();
    await this.retry.try(async () => {
      const currentUrl = await this.browser.getCurrentUrl();
      this.log.info('currentUrl', currentUrl);
      if (!currentUrl.match(/dataViews\/.+\?/)) {
        throw new Error('Data view not created');
      } else {
        this.log.debug('Data view created: ' + currentUrl);
      }
    });

    if (!isStandardIndexPattern) {
      const badges = await this.find.allByCssSelector('.euiBadge__text');
      const rollupBadge = badges.filter(async (badge) => {
        return (await badge.getVisibleText()) === 'Rollup';
      });
      expect(rollupBadge.length).to.equal(1);
    }

    return await this.getIndexPatternIdFromUrl();
  }

  async editIndexPattern(
    indexPatternName: string,
    // null to bypass default value
    timefield: string | null = '@timestamp',
    dataViewName?: string,
    errorCheck?: boolean
  ) {
    if (!indexPatternName) {
      throw new Error('No Data View name provided for edit');
    }

    await this.clickEditIndexButton();
    await this.header.waitUntilLoadingHasFinished();

    let hasSubmittedTheForm = false;

    await this.retry.try(async () => {
      if (hasSubmittedTheForm && !(await this.testSubjects.exists('indexPatternEditorFlyout'))) {
        // the flyout got closed
        return;
      }
      if (dataViewName) {
        await this.setNameField(dataViewName);
      }
      await this.setIndexPatternField(indexPatternName);
      await this.header.waitUntilLoadingHasFinished();
      if (timefield) {
        await this.selectTimeFieldOption(timefield);
      }
      const indexPatternSaveBtn = await this.getSaveIndexPatternButton();
      await indexPatternSaveBtn.click();

      hasSubmittedTheForm = true;

      const form = await this.testSubjects.findAll('indexPatternEditorForm');
      const hasValidationErrors =
        form.length !== 0 && (await form[0].getAttribute('data-validation-error')) === '1';
      expect(hasValidationErrors).to.eql(false);
    });

    if (errorCheck) {
      await this.retry.try(async () => {
        this.log.debug('getAlertText');
        await this.testSubjects.getVisibleText('confirmModalTitleText');
      });
      await this.retry.try(async () => {
        this.log.debug('acceptConfirmation');
        await this.testSubjects.click('confirmModalConfirmButton');
      });
    }

    await this.header.waitUntilLoadingHasFinished();
    return await this.getIndexPatternIdFromUrl();
  }

  async clickAddNewIndexPatternButton() {
    await this.common.scrollKibanaBodyTop();
    await this.testSubjects.click('createDataViewButton');
  }

  async selectRollupIndexPatternType() {
    await this.testSubjects.click('typeField');
    await this.testSubjects.click('rollupType');
  }

  async getIndexPatternIdFromUrl() {
    const currentUrl = await this.browser.getCurrentUrl();
    const indexPatternId = currentUrl.match(/.*\/(.*)/)![1];

    this.log.debug('index pattern ID: ', indexPatternId);

    return indexPatternId;
  }

  async setIndexPatternField(indexPatternName = 'logstash-*') {
    this.log.debug(`setIndexPatternField(${indexPatternName})`);
    const field = await this.getIndexPatternField();
    await field.clearValueWithKeyboard();

    if (
      indexPatternName.charAt(0) === '*' &&
      indexPatternName.charAt(indexPatternName.length - 1) === '*'
    ) {
      // this is a special case when the index pattern name starts with '*'
      // like '*:makelogs-*' where the UI will not append *
      await field.type(indexPatternName, { charByChar: true });
    } else if (indexPatternName.charAt(indexPatternName.length - 1) === '*') {
      // the common case where the UI will append '*' automatically so we won't type it
      const tempName = indexPatternName.slice(0, -1);
      await field.type(tempName, { charByChar: true });
    } else {
      // case where we don't want the * appended so we'll remove it if it was added
      await field.type(indexPatternName, { charByChar: true });
      const tempName = await field.getAttribute('value');
      if (tempName?.length ?? 0 > indexPatternName.length) {
        await field.type(this.browser.keys.DELETE, { charByChar: true });
      }
    }
    const currentName = await field.getAttribute('value');
    this.log.debug(`setIndexPatternField set to ${currentName}`);
    expect(currentName).to.eql(indexPatternName);
    await this.retry.waitFor('validating the given index pattern should be finished', async () => {
      const isValidating = await field.getAttribute('data-is-validating');
      return isValidating === '0';
    });
  }

  async removeIndexPattern() {
    let alertText;
    await this.retry.try(async () => {
      this.log.debug('click delete index pattern button');
      await this.clickDeletePattern();
    });
    await this.retry.try(async () => {
      this.log.debug('getAlertText');
      alertText = await this.testSubjects.getVisibleText('confirmModalTitleText');
    });
    await this.retry.try(async () => {
      this.log.debug('acceptConfirmation');
      await this.testSubjects.click('confirmModalConfirmButton');
    });
    await this.retry.try(async () => {
      const currentUrl = await this.browser.getCurrentUrl();
      if (currentUrl.match(/index_patterns\/.+\?/)) {
        throw new Error('Index pattern not removed');
      }
    });
    return alertText;
  }

  async clickScriptedFieldsTab() {
    this.log.debug('click Scripted Fields tab');
    await this.testSubjects.click('tab-scriptedFields');
  }

  async clickSourceFiltersTab() {
    this.log.debug('click Source Filters tab');
    await this.testSubjects.click('tab-sourceFilters');
  }

  async clickRelationshipsTab() {
    this.log.debug('click Relationships tab');
    await this.testSubjects.click('tab-relationships');
  }

  async editScriptedField(name: string) {
    await this.filterField(name);
    await this.find.clickByCssSelector('.euiTableRowCell--hasActions button:first-child');
  }

  async addScriptedField(
    name: string,
    language: string,
    type: string,
    format: Record<string, any> | null,
    popularity: string,
    script: string
  ) {
    await this.goToAddScriptedField();
    await this.setScriptedFieldName(name);
    if (language) await this.setScriptedFieldLanguage(language);
    if (type) await this.setScriptedFieldType(type);
    if (format) {
      await this.setFieldFormat(format.format);
      // null means leave - default - which has no other settings
      // Url adds Type, Url Template, and Label Template
      // Date adds moment.js format pattern (Default: "MMMM Do YYYY, HH:mm:ss.SSS")
      // String adds Transform
      switch (format.format) {
        case 'url':
          await this.setScriptedFieldUrlType(format.type);
          await this.setScriptedFieldUrlTemplate(format.template);
          await this.setScriptedFieldUrlLabelTemplate(format.labelTemplate);
          break;
        case 'date':
          await this.setScriptedFieldDatePattern(format.datePattern);
          break;
        case 'string':
          await this.setScriptedFieldStringTransform(format.stringTransform);
          break;
      }
    }
    if (popularity) await this.setScriptedFieldPopularity(popularity);
    await this.setScriptedFieldScript(script);
    await this.clickSaveScriptedField();
  }

  async addRuntimeField(name: string, type: string, script: string, doSaveField = true) {
    const startingCount = parseInt(await this.getFieldsTabCount(), 10);
    await this.clickAddField();
    await this.setFieldName(name);
    await this.setFieldType(type);
    if (script) {
      await this.setFieldScript(script);
    }

    if (doSaveField) {
      await this.clickSaveField();
      await this.retry.try(async () => {
        expect(parseInt(await this.getFieldsTabCount(), 10)).to.be(startingCount + 1);
      });
    }
  }

  async addCompositeRuntimeField(
    name: string,
    script: string,
    doSaveField = true,
    subfieldCount = 0
  ) {
    await this.clickAddField();
    await this.setFieldName(name);
    await this.setFieldType('Composite');
    await this.setCompositeScript(script);
    if (subfieldCount > 0) {
      await this.testSubjects.find(`typeField_${subfieldCount - 1}`);
    }
    if (doSaveField) {
      await this.clickSaveField();
    }
  }

  async editFieldFilter(name: string, newName: string) {
    await this.testSubjects.click(`edit_filter-${name}`);
    await this.testSubjects.setValue(`filter_input_${name}`, newName);
    await this.testSubjects.click(`save_filter-${name}`);

    const table = await this.find.byClassName('euiTable');
    await this.retry.waitFor('field filter to be changed', async () => {
      const tableCells = await table.findAllByCssSelector('td');
      const fieldNames = await Promise.all(
        tableCells.map(async (cell) => {
          return (await cell.getVisibleText()).trim();
        })
      );
      return fieldNames.includes(newName);
    });
  }

  async addFieldFilter(name: string) {
    await this.testSubjects.click('tab-sourceFilters');
    await this.find.setValue('.euiFieldText', name);
    await this.find.clickByButtonText('Add');
    const table = await this.find.byClassName('euiTable');
    await this.retry.waitFor('field filter to be added', async () => {
      const tableCells = await table.findAllByCssSelector('td');
      const fieldNames = await Promise.all(
        tableCells.map(async (cell) => {
          return (await cell.getVisibleText()).trim();
        })
      );
      return fieldNames.includes(name);
    });
  }

  public async confirmSave() {
    await this.testSubjects.setValue('saveModalConfirmText', 'change');
    await this.testSubjects.click('confirmModalConfirmButton');
  }

  public async confirmDelete() {
    await this.testSubjects.setValue('deleteModalConfirmText', 'remove');
    await this.testSubjects.click('confirmModalConfirmButton');
  }

  async closeIndexPatternFieldEditor() {
    await this.testSubjects.click('closeFlyoutButton');

    // We might have unsaved changes and we need to confirm inside the modal
    if (await this.testSubjects.exists('runtimeFieldModifiedFieldConfirmModal')) {
      this.log.debug('Unsaved changes for the field: need to confirm');
      await this.testSubjects.click('confirmModalConfirmButton');
    }

    await this.retry.waitFor('field editor flyout to close', async () => {
      return !(await this.testSubjects.exists('fieldEditor'));
    });
  }

  async clickAddField() {
    this.log.debug('click Add Field');
    await this.testSubjects.click('addField');
    await this.retry.try(async () => {
      await this.testSubjects.existOrFail('flyoutTitle');
    });
  }

  async clickSaveField() {
    this.log.debug('click Save');
    await this.testSubjects.click('fieldSaveButton');
    await this.header.waitUntilLoadingHasFinished();
  }

  async setFieldName(name: string) {
    this.log.debug('set field name = ' + name);
    await this.testSubjects.setValue('nameField', name);
  }

  async setFieldType(type: string) {
    const typeFieldDataTestSubj = 'typeField';
    this.log.debug('set type = ' + type);
    await this.retry.try(async () => {
      await this.comboBox.set(typeFieldDataTestSubj, type);
      const comboBox = await this.testSubjects.find(typeFieldDataTestSubj);
      expect(await this.comboBox.isOptionSelected(comboBox, type)).to.be(true);
    });
  }

  async setFieldScript(script: string) {
    this.log.debug('set script = ' + script);
    await this.toggleRow('valueRow');
    await this.monacoEditor.waitCodeEditorReady('valueRow');
    await this.monacoEditor.setCodeEditorValue(script);
  }

  async setFieldScriptWithoutToggle(script: string) {
    this.log.debug('set script without toggle = ' + script);
    await this.monacoEditor.waitCodeEditorReady('valueRow');
    await this.monacoEditor.setCodeEditorValue(script);
  }

  async setCompositeScript(script: string) {
    this.log.debug('set composite script = ' + script);
    await this.monacoEditor.waitCodeEditorReady('scriptFieldRow');
    await this.monacoEditor.setCodeEditorValue(script);
  }

  async goToAddScriptedField() {
    this.log.debug('go to Add Scripted Field url');
    const url = await this.browser.getCurrentUrl();
    const newUrl = url.split('#')[0];
    await this.browser.get(newUrl + '/create-field/');
    await this.header.waitUntilLoadingHasFinished();
  }

  async clickSaveScriptedField() {
    this.log.debug('click Save Scripted Field');
    await this.testSubjects.click('fieldSaveButton');
    await this.header.waitUntilLoadingHasFinished();
  }

  async setScriptedFieldName(name: string) {
    this.log.debug('set scripted field name = ' + name);
    await this.testSubjects.setValue('editorFieldName', name);
  }

  async setScriptedFieldLanguage(language: string) {
    this.log.debug('set scripted field language = ' + language);
    await this.find.clickByCssSelector(
      'select[data-test-subj="editorFieldLang"] > option[value="' + language + '"]'
    );
  }

  async setScriptedFieldType(type: string) {
    this.log.debug('set scripted field type = ' + type);
    await this.find.clickByCssSelector(
      'select[data-test-subj="editorFieldType"] > option[value="' + type + '"]'
    );
  }

  async setFieldFormat(format: string) {
    this.log.debug('set scripted field format = ' + format);
    await this.find.clickByCssSelector(
      'select[data-test-subj="editorSelectedFormatId"] > option[value="' + format + '"]'
    );
  }

  async toggleRow(rowTestSubj: string) {
    this.log.debug('toggling tow = ' + rowTestSubj);
    const row = await this.testSubjects.find(rowTestSubj);
    const rowToggle = (await row.findAllByCssSelector('[data-test-subj="toggle"]'))[0];
    await rowToggle.click();
    return row;
  }

  async setCustomLabel(label: string) {
    this.log.debug('set custom label = ' + label);
    await (
      await this.testSubjects.findDescendant(
        'input',
        await this.testSubjects.find('customLabelRow')
      )
    ).type(label);
  }

  async setScriptedFieldUrlType(type: string) {
    this.log.debug('set scripted field Url type = ' + type);
    await this.find.clickByCssSelector(
      'select[data-test-subj="urlEditorType"] > option[value="' + type + '"]'
    );
  }

  async setScriptedFieldUrlTemplate(template: string) {
    this.log.debug('set scripted field Url Template = ' + template);
    const urlTemplateField = await this.find.byCssSelector(
      'input[data-test-subj="urlEditorUrlTemplate"]'
    );
    await urlTemplateField.type(template);
  }

  async setScriptedFieldUrlLabelTemplate(labelTemplate: string) {
    this.log.debug('set scripted field Url Label Template = ' + labelTemplate);
    const urlEditorLabelTemplate = await this.find.byCssSelector(
      'input[data-test-subj="urlEditorLabelTemplate"]'
    );
    await urlEditorLabelTemplate.type(labelTemplate);
  }

  async setScriptedFieldDatePattern(datePattern: string) {
    this.log.debug('set scripted field Date Pattern = ' + datePattern);
    const datePatternField = await this.find.byCssSelector(
      'input[data-test-subj="dateEditorPattern"]'
    );
    // clearValue does not work here
    // Send Backspace event for each char in value string to clear field
    await datePatternField.clearValueWithKeyboard({ charByChar: true });
    await datePatternField.type(datePattern);
  }

  async setScriptedFieldStringTransform(stringTransform: string) {
    this.log.debug('set scripted field string Transform = ' + stringTransform);
    await this.find.clickByCssSelector(
      'select[data-test-subj="stringEditorTransform"] > option[value="' + stringTransform + '"]'
    );
  }

  async setScriptedFieldPopularity(popularity: string) {
    this.log.debug('set scripted field popularity = ' + popularity);
    await this.testSubjects.setValue('editorFieldCount', popularity);
  }

  async setScriptedFieldScript(script: string) {
    this.log.debug('set scripted field script = ' + script);
    await this.monacoEditor.setCodeEditorValue(script);
  }

  async openScriptedFieldHelp(activeTab: string) {
    this.log.debug('open Scripted Fields help');
    let isOpen = await this.testSubjects.exists('scriptedFieldsHelpFlyout');
    if (!isOpen) {
      await this.retry.try(async () => {
        await this.testSubjects.click('scriptedFieldsHelpLink');
        isOpen = await this.testSubjects.exists('scriptedFieldsHelpFlyout');
        if (!isOpen) {
          throw new Error('Failed to open scripted fields help');
        }
      });
    }

    if (activeTab) {
      await this.testSubjects.click(activeTab);
    }
  }

  async closeScriptedFieldHelp() {
    await this.flyout.ensureClosed('scriptedFieldsHelpFlyout');
  }

  async executeScriptedField(script: string, additionalField?: string) {
    this.log.debug('execute Scripted Fields help');
    await this.closeScriptedFieldHelp(); // ensure script help is closed so script input is not blocked
    await this.setScriptedFieldScript(script);
    await this.openScriptedFieldHelp('testTab');
    if (additionalField) {
      await this.comboBox.set('additionalFieldsSelect', additionalField);
      await this.testSubjects.find('scriptedFieldPreview');
      await this.testSubjects.click('runScriptButton');
      await this.testSubjects.waitForDeleted('.euiLoadingSpinner');
    }
    let scriptResults: string = '';
    await this.retry.try(async () => {
      scriptResults = await this.testSubjects.getVisibleText('scriptedFieldPreview');
    });
    return scriptResults;
  }

  async clickEditFieldFormat() {
    await this.testSubjects.click('editFieldFormat');
  }

  async associateIndexPattern(oldIndexPatternId: string, newIndexPatternTitle: string) {
    await this.find.clickByCssSelector(
      `select[data-test-subj="managementChangeIndexSelection-${oldIndexPatternId}"] >
      [data-test-subj="indexPatternOption-${newIndexPatternTitle}"]`
    );
  }

  async changeAndValidateFieldFormat({
    name,
    fieldType,
    expectedPreviewText,
  }: {
    name: string;
    fieldType: string;
    expectedPreviewText: string;
  }) {
    await this.filterField(name);
    await this.setFieldTypeFilter(fieldType);
    await this.testSubjects.click('editFieldFormat');

    expect(await this.testSubjects.getVisibleText('flyoutTitle')).to.eql(`Edit field '${name}'`);

    await this.retry.tryForTime(5000, async () => {
      const previewText = await this.testSubjects.getVisibleText('fieldPreviewItem > value');
      expect(previewText).to.eql(
        expectedPreviewText,
        `Expected previewText to eql [${expectedPreviewText}], but got: [${previewText}]`
      );
    });
    await this.closeIndexPatternFieldEditor();
  }
}
