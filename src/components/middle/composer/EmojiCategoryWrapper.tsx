import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import { EMOJI_SIZE_PICKER } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import windowSize from '../../../util/windowSize';
import { REM } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useMediaTransitionDeprecated from '../../../hooks/useMediaTransitionDeprecated';
import useOldLang from '../../../hooks/useOldLang';

const EMOJIS_PER_ROW_ON_DESKTOP = 8;
const EMOJI_MARGIN = 0.625 * REM;
const EMOJI_VERTICAL_MARGIN = 0.25 * REM;
const EMOJI_VERTICAL_MARGIN_MOBILE = 0.5 * REM;
const MOBILE_CONTAINER_PADDING = 0.5 * REM;

type OwnProps = {
  category: EmojiCategory;
  index: number;
  shouldRender: boolean;
  className?: string;
  children: React.ReactNode;
  title?: string;
  ref?: RefObject<HTMLDivElement>;
};

const EmojiCategoryWrapper: FC<OwnProps> = ({
  category, index, shouldRender, className, children, title, ref,
}) => {
  const transitionClassNames = useMediaTransitionDeprecated(shouldRender);
  const lang = useOldLang();
  const { isMobile } = useAppLayout();

  const emojisPerRow = isMobile
    ? Math.floor(
      (windowSize.get().width - MOBILE_CONTAINER_PADDING + EMOJI_MARGIN) / (EMOJI_SIZE_PICKER + EMOJI_MARGIN),
    )
    : EMOJIS_PER_ROW_ON_DESKTOP;
  const height = Math.ceil(category.emojis.length / emojisPerRow)
    * (EMOJI_SIZE_PICKER + (isMobile ? EMOJI_VERTICAL_MARGIN_MOBILE : EMOJI_VERTICAL_MARGIN));

  return (
    <div
      ref={ref}
      key={category.id}
      id={`emoji-category-${index}`}
      className={buildClassName('symbol-set', className)}
    >
      {title && (
        <div className="symbol-set-header">
          <p className="symbol-set-name" dir="auto">
            {title}
          </p>
        </div>
      )}
      <div
        className={buildClassName('symbol-set-container', transitionClassNames)}
        style={`height: ${height}px;`}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default memo(EmojiCategoryWrapper);
