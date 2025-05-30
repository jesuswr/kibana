/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiButton } from '@elastic/eui';
import React, { useCallback, useEffect, useState } from 'react';
import { css } from '@emotion/react';
import { v4 as uuidv4 } from 'uuid';

import { getAllIndicesToCheck } from './utils/get_all_indices_to_check';
import { useResultsRollupContext } from '../../../contexts/results_rollup_context';
import { checkIndex } from '../../../utils/check_index';
import { useDataQualityContext } from '../../../data_quality_context';
import * as i18n from '../../../translations';
import type { IndexToCheck } from '../../../types';
import { useAbortControllerRef } from '../../../hooks/use_abort_controller_ref';

const styles = {
  checkAllButton: css({
    width: '112px',
  }),
};

async function wait(ms: number) {
  const delay = () =>
    new Promise((resolve) =>
      setTimeout(() => {
        resolve('');
      }, ms)
    );

  return delay();
}

interface Props {
  incrementCheckAllIndiciesChecked: () => void;
  setCheckAllIndiciesChecked: (checkAllIndiciesChecked: number) => void;
  setCheckAllTotalIndiciesToCheck: (checkAllTotalIndiciesToCheck: number) => void;
  setIndexToCheck: (indexToCheck: IndexToCheck | null) => void;
}

const DELAY_AFTER_EVERY_CHECK_COMPLETES = 3000; // ms

const CheckAllComponent: React.FC<Props> = ({
  incrementCheckAllIndiciesChecked,
  setCheckAllIndiciesChecked,
  setCheckAllTotalIndiciesToCheck,
  setIndexToCheck,
}) => {
  const { httpFetch, isILMAvailable, formatBytes, formatNumber, ilmPhases, patterns } =
    useDataQualityContext();
  const { onCheckCompleted, patternIndexNames } = useResultsRollupContext();
  const abortControllerRef = useAbortControllerRef();
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const cancelIfRunning = useCallback(() => {
    if (isRunning) {
      if (!abortControllerRef.current.signal.aborted) {
        setIndexToCheck(null);
        setIsRunning(false);
        setCheckAllIndiciesChecked(0);
        setCheckAllTotalIndiciesToCheck(0);
        abortControllerRef.current.abort();
      }
    }
  }, [
    abortControllerRef,
    isRunning,
    setCheckAllIndiciesChecked,
    setCheckAllTotalIndiciesToCheck,
    setIndexToCheck,
  ]);

  const onClick = useCallback(() => {
    async function beginCheck() {
      const allIndicesToCheck = getAllIndicesToCheck(patternIndexNames);
      const startTime = Date.now();
      const batchId = uuidv4();
      let checked = 0;

      setCheckAllIndiciesChecked(0);
      setCheckAllTotalIndiciesToCheck(allIndicesToCheck.length);

      for (const { indexName, pattern } of allIndicesToCheck) {
        if (!abortControllerRef.current.signal.aborted) {
          setIndexToCheck({
            indexName,
            pattern,
          });

          await checkIndex({
            abortController: abortControllerRef.current,
            batchId,
            checkAllStartTime: startTime,
            formatBytes,
            formatNumber,
            isCheckAll: true,
            httpFetch,
            indexName,
            isLastCheck:
              allIndicesToCheck.length > 0 ? checked === allIndicesToCheck.length - 1 : true,
            onCheckCompleted,
            pattern,
          });

          if (!abortControllerRef.current.signal.aborted) {
            await wait(DELAY_AFTER_EVERY_CHECK_COMPLETES);
            incrementCheckAllIndiciesChecked();
            checked++;
          }
        }
      }

      if (!abortControllerRef.current.signal.aborted) {
        setIndexToCheck(null);
        setIsRunning(false);
      }
    }

    if (isRunning) {
      cancelIfRunning();
    } else {
      abortControllerRef.current = new AbortController();
      setIsRunning(true);
      beginCheck();
    }
  }, [
    abortControllerRef,
    cancelIfRunning,
    formatBytes,
    formatNumber,
    httpFetch,
    incrementCheckAllIndiciesChecked,
    isRunning,
    onCheckCompleted,
    patternIndexNames,
    setCheckAllIndiciesChecked,
    setCheckAllTotalIndiciesToCheck,
    setIndexToCheck,
  ]);

  useEffect(() => {
    return () => {
      // cancel any checks in progress when the patterns or ilm phases change
      cancelIfRunning();
    };
  }, [cancelIfRunning, ilmPhases, patterns]);

  const disabled = isILMAvailable && ilmPhases.length === 0;

  return (
    <EuiButton
      css={styles.checkAllButton}
      aria-label={isRunning ? i18n.CANCEL : i18n.CHECK_ALL}
      data-test-subj="checkAll"
      disabled={disabled}
      fill={!isRunning}
      onClick={onClick}
    >
      {isRunning ? i18n.CANCEL : i18n.CHECK_ALL}
    </EuiButton>
  );
};

export const CheckAll = React.memo(CheckAllComponent);
