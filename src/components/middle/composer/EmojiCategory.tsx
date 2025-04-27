import type { FC } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { RECENT_SYMBOL_SET_ID, SEARCH_EMOJIS_SET_ID } from '../../../config';

import { useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useOldLang from '../../../hooks/useOldLang';

import EmojiButton from './EmojiButton';
import EmojiCategoryWrapper from './EmojiCategoryWrapper';

type OwnProps = {
  category: EmojiCategory;
  index: number;
  allEmojis: AllEmojis;
  observeIntersection: ObserveFn;
  shouldRender: boolean;
  onEmojiSelect: (emoji: string, name: string) => void;
  className?: string;
};

const EmojiCategory: FC<OwnProps> = ({
  category, index, allEmojis, observeIntersection, shouldRender, onEmojiSelect, className,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  useOnIntersect(ref, observeIntersection);
  const lang = useOldLang();

  return (
    <EmojiCategoryWrapper
      ref={ref}
      title={lang(category.id === SEARCH_EMOJIS_SET_ID
        ? 'SearchEmojis'
        : (category.id === RECENT_SYMBOL_SET_ID ? 'RecentStickers' : `Emoji${index + 1}`))}
      category={category}
      index={index + 1}
      shouldRender={shouldRender}
      className={className}
    >
      {shouldRender && category.emojis.map((name) => {
        const emoji = allEmojis[name];
        // Recent emojis may contain emoticons that are no longer in the list
        if (!emoji) {
          return undefined;
        }
        // Some emojis have multiple skins and are represented as an Object with emojis for all skins.
        // For now, we select only the first emoji with 'neutral' skin.
        const displayedEmoji = 'id' in emoji ? emoji : emoji[1];

        return (
          <EmojiButton
            key={displayedEmoji.id}
            emoji={displayedEmoji}
            onClick={onEmojiSelect}
          />
        );
      })}
    </EmojiCategoryWrapper>
  );
};

export default memo(EmojiCategory);
