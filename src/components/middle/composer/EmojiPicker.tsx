import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo,
  useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type {
  ApiAvailableReaction, ApiReaction, ApiReactionWithPaid, ApiSticker, ApiStickerSet,
} from '../../../api/types';
import type { StickerSetOrReactionsSetOrRecent } from '../../../types';
import type { IconName } from '../../../types/icons';
import type {
  EmojiData,
  EmojiModule,
  EmojiRawData,
} from '../../../util/emoji/emoji';

import {
  EMOJI_SIZE_PICKER,
  MENU_TRANSITION_DURATION, POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  TOP_SYMBOL_SET_ID,
} from '../../../config';
import { isSameReaction } from '../../../global/helpers';
import {
  selectCanPlayAnimatedEmojis, selectChatFullInfo, selectIsChatWithSelf, selectIsCurrentUserPremium,
} from '../../../global/selectors';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import animateScroll from '../../../util/animateScroll';
import buildClassName from '../../../util/buildClassName';
import { uncompressEmoji } from '../../../util/emoji/emoji';
import { pickTruthy, unique } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import { REM } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import useScrolledState from '../../../hooks/useScrolledState';
import { useStickerPickerObservers } from '../../common/hooks/useStickerPickerObservers';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import CustomEmojiCover from '../../common/CustomEmojiCover';
import {
  RECENT_DEFAULT_STATUS_COUNT,
  RECENT_REACTIONS_COUNT,
  TOP_REACTIONS_COUNT,
} from '../../common/CustomEmojiPicker';
import Icon from '../../common/icons/Icon';
import StickerButton from '../../common/StickerButton';
import StickerSet from '../../common/StickerSet';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import EmojiButton from './EmojiButton';
import EmojiCategory from './EmojiCategory';
import EmojiCategoryWrapper from './EmojiCategoryWrapper';
import SymbolSearch, {
  SYMBOL_SEARCH_IS_DEFAULT,
  SYMBOL_SEARCH_IS_SELECING_ICONS,
  SYMBOL_SEARCH_IS_TYPING,
} from './SymbolSearch';

import './EmojiPicker.scss';
import pickerStyles from './StickerPicker.module.scss';

type OwnProps = {
  className?: string;
  onEmojiSelect: (emoji: string, name: string) => void;
  chatId?: string;
  isHidden?: boolean;
  loadAndPlay: boolean;
  idPrefix?: string;
  isTranslucent?: boolean;
  isStatusPicker?: boolean;
  isReactionPicker?: boolean;
  withDefaultTopicIcons?: boolean;
  selectedReactionIds?: string[];
  onCustomEmojiSelect: (sticker: ApiSticker) => void;
  onReactionSelect?: (reaction: ApiReactionWithPaid) => void;
  onReactionContext?: (reaction: ApiReactionWithPaid) => void;
  onContextMenuOpen?: NoneToVoidFunction;
  onContextMenuClose?: NoneToVoidFunction;
  onContextMenuClick?: NoneToVoidFunction;
};

type StateProps = {
  customEmojisById?: Record<string, ApiSticker>;
  recentCustomEmojiIds?: string[];
  recentStatusEmojis?: ApiSticker[];
  chatEmojiSetId?: string;
  topReactions?: ApiReaction[];
  recentReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  stickerSetsById: Record<string, ApiStickerSet>;
  availableReactions?: ApiAvailableReaction[];
  addedCustomEmojiIds?: string[];
  defaultTopicIconsId?: string;
  defaultStatusIconsId?: string;
  customEmojiFeaturedIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  isWithPaidReaction?: boolean;
  recentEmojis: string[];
};

// type StateProps = Pick<GlobalState, 'recentEmojis'>;

type EmojiCategoryData = { id: string; name: string; emojis: string[] };

const ICONS_BY_CATEGORY: Record<string, IconName> = {
  recent: 'recent',
  people: 'smile',
  nature: 'animals',
  foods: 'eats',
  activity: 'sport',
  places: 'car',
  objects: 'lamp',
  symbols: 'language',
  flags: 'flag',
};

const OPEN_ANIMATION_DELAY = 200;
const SMOOTH_SCROLL_DISTANCE = 100;
const FOCUS_MARGIN = 3.25 * REM;
const HEADER_BUTTON_WIDTH = 2.625 * REM; // Includes margins
const INTERSECTION_THROTTLE = 200;
const DEFAULT_ID_PREFIX = 'emoji-custom-emoji-set';
const categoryIntersections: boolean[] = [];

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;

const EmojiPicker: FC<OwnProps & StateProps> = ({
  className,
  recentEmojis,
  onEmojiSelect,
  isHidden,
  loadAndPlay,
  addedCustomEmojiIds,
  customEmojisById,
  recentCustomEmojiIds,
  selectedReactionIds,
  recentStatusEmojis,
  stickerSetsById,
  chatEmojiSetId,
  topReactions,
  recentReactions,
  availableReactions,
  idPrefix = DEFAULT_ID_PREFIX,
  customEmojiFeaturedIds,
  canAnimate,
  isReactionPicker,
  isStatusPicker,
  isTranslucent,
  isSavedMessages,
  isCurrentUserPremium,
  withDefaultTopicIcons,
  defaultTopicIconsId,
  defaultStatusIconsId,
  defaultTagReactions,
  isWithPaidReaction,
  onReactionSelect,
  onReactionContext,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuClick,
  onCustomEmojiSelect,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const categoryRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const customHeaderRef = useRef<HTMLDivElement>(null);

  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const [emojis, setEmojis] = useState<AllEmojis>();
  const [searchResults, setSearchResults] = useState<(ApiSticker | string)[]>();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(SYMBOL_SEARCH_IS_DEFAULT);
  const [resetSearching, setResetSearching] = useState(false);
  const [resetSearching1, setResetSearching1] = useState(false);
  const [isTopOfContainer, setIsTopOfContainer] = useState(true);
  const [customEmojiIndex, setCustomEmojiIndex] = useState(-1);
  const [emojiIndex, setEmojiIndex] = useState(-1);
  // const [isTyping, setIsTyping] = useState(false);
  const { isMobile } = useAppLayout();
  const {
    handleScroll: mainHandleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const handleContentScroll = (e: React.UIEvent<HTMLElement>) => {
    mainHandleContentScroll(e);

    if (!containerRef?.current) return;

    const scrollTop = containerRef.current.scrollTop;

    if (scrollTop < 5) {
      animateHorizontalScroll(categoryRef?.current!, 0);
      setIsTopOfContainer(true);
    } else {
      setIsTopOfContainer(false);
    }
  };

  /* Start custom emoji */
  const recentCustomEmojis = useMemo(() => {
    return isStatusPicker
      ? recentStatusEmojis
      : Object.values(pickTruthy(customEmojisById!, recentCustomEmojiIds!));
  }, [customEmojisById, isStatusPicker, recentCustomEmojiIds, recentStatusEmojis]);

  const prefix = `${idPrefix}-emoji-custom-emoji`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden, FOCUS_MARGIN);

  const selectStickerSetWithRestSearch = useLastCallback((index: number) => {
    setIsSearching(SYMBOL_SEARCH_IS_DEFAULT);
    setResetSearching(!resetSearching);
    setCustomEmojiIndex(index);
  });

  useEffect(() => {
    if (customEmojiIndex === -1) {
      return;
    }
    selectStickerSet(customEmojiIndex);
  }, [customEmojiIndex, selectStickerSet, resetSearching]);

  const canLoadAndPlay = usePrevDuringAnimation(loadAndPlay || undefined, SLIDE_TRANSITION_DURATION);

  const lang = useOldLang();

  const areAddedLoaded = Boolean(addedCustomEmojiIds);

  const allSets = useMemo(() => {
    const defaultSets: StickerSetOrReactionsSetOrRecent[] = [];

    if (isReactionPicker && isSavedMessages) {
      if (defaultTagReactions?.length) {
        defaultSets.push({
          id: TOP_SYMBOL_SET_ID,
          accessHash: '',
          title: lang('PremiumPreviewTags'),
          reactions: defaultTagReactions,
          count: defaultTagReactions.length,
          isEmoji: true,
        });
      }
    }

    if (isReactionPicker && !isSavedMessages) {
      const topReactionsSlice: ApiReactionWithPaid[] = topReactions?.slice(0, TOP_REACTIONS_COUNT) || [];
      if (isWithPaidReaction) {
        topReactionsSlice.unshift({ type: 'paid' });
      }
      if (topReactionsSlice?.length) {
        defaultSets.push({
          id: TOP_SYMBOL_SET_ID,
          accessHash: '',
          title: lang('Reactions'),
          reactions: topReactionsSlice,
          count: topReactionsSlice.length,
          isEmoji: true,
        });
      }

      const cleanRecentReactions = (recentReactions || [])
        .filter((reaction) => !topReactionsSlice.some((topReaction) => isSameReaction(topReaction, reaction)))
        .slice(0, RECENT_REACTIONS_COUNT);
      const cleanAvailableReactions = (availableReactions || [])
        .filter(({ isInactive }) => !isInactive)
        .map(({ reaction }) => reaction)
        .filter((reaction) => {
          return !topReactionsSlice.some((topReaction) => isSameReaction(topReaction, reaction))
            && !cleanRecentReactions.some((topReaction) => isSameReaction(topReaction, reaction));
        });
      if (cleanAvailableReactions?.length || cleanRecentReactions?.length) {
        const isPopular = !cleanRecentReactions?.length;
        const allRecentReactions = cleanRecentReactions.concat(cleanAvailableReactions);
        defaultSets.push({
          id: isPopular ? POPULAR_SYMBOL_SET_ID : RECENT_SYMBOL_SET_ID,
          accessHash: '',
          title: lang(isPopular ? 'PopularReactions' : 'RecentStickers'),
          reactions: allRecentReactions,
          count: allRecentReactions.length,
          isEmoji: true,
        });
      }
    } else if (isStatusPicker) {
      const defaultStatusIconsPack = stickerSetsById[defaultStatusIconsId!];
      if (defaultStatusIconsPack?.stickers?.length) {
        const stickers = defaultStatusIconsPack.stickers
          .slice(0, RECENT_DEFAULT_STATUS_COUNT)
          .concat(recentCustomEmojis || []);
        defaultSets.push({
          ...defaultStatusIconsPack,
          stickers,
          count: stickers.length,
          id: RECENT_SYMBOL_SET_ID,
          title: lang('RecentStickers'),
        });
      }
    } else if (withDefaultTopicIcons) {
      const defaultTopicIconsPack = stickerSetsById[defaultTopicIconsId!];
      if (defaultTopicIconsPack.stickers?.length) {
        defaultSets.push({
          ...defaultTopicIconsPack,
          id: RECENT_SYMBOL_SET_ID,
          title: lang('RecentStickers'),
        });
      }
    }

    const userSetIds = [...(addedCustomEmojiIds || [])];
    if (chatEmojiSetId) {
      userSetIds.unshift(chatEmojiSetId);
    }

    const setIdsToDisplay = unique(userSetIds.concat(customEmojiFeaturedIds || []));

    const setsToDisplay = Object.values(pickTruthy(stickerSetsById, setIdsToDisplay));

    return [
      ...defaultSets,
      ...setsToDisplay,
    ];
  }, [
    addedCustomEmojiIds, isReactionPicker, isStatusPicker, withDefaultTopicIcons, recentCustomEmojis,
    customEmojiFeaturedIds, stickerSetsById, topReactions, availableReactions, lang, recentReactions,
    defaultStatusIconsId, defaultTopicIconsId, isSavedMessages, defaultTagReactions, chatEmojiSetId,
    isWithPaidReaction,
  ]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);
  /* End custom emoji */

  const { observe: observeIntersection } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  }, (entries) => {
    entries.forEach((entry) => {
      const { id } = entry.target as HTMLDivElement;
      if (!id || !id.startsWith('emoji-category-')) {
        return;
      }

      const index = Number(id.replace('emoji-category-', ''));
      categoryIntersections[index] = entry.isIntersecting;
    });

    const minIntersectingIndex = categoryIntersections.reduce((lowestIndex, isIntersecting, index) => {
      return isIntersecting && index < lowestIndex ? index : lowestIndex;
    }, Infinity);

    if (minIntersectingIndex === Infinity) {
      return;
    }

    setActiveCategoryIndex(minIntersectingIndex);
  });

  const canRenderContents = useAsyncRendering([], MENU_TRANSITION_DURATION);
  const shouldRenderContent = emojis && canRenderContents && !noPopulatedSets && areAddedLoaded;

  useHorizontalScroll(headerRef, !(isMobile && shouldRenderContent));

  // Scroll header when active set updates
  useEffect(() => {
    if (!categories) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeCategoryIndex * HEADER_BUTTON_WIDTH - header.offsetWidth / 2 + HEADER_BUTTON_WIDTH / 2;

    animateHorizontalScroll(header, newLeft);
  }, [categories, activeCategoryIndex]);

  const allCategories = useMemo(() => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }
    const themeCategories = [...categories];
    return themeCategories;
  }, [categories]);

  const themeRecent = useMemo(() => {
    const ret = [];
    if (recentEmojis?.length) {
      ret.push(...recentEmojis);
    }
    recentCustomEmojis?.map((emoji) => ret.push(emoji));
    return ret;
  }, [recentCustomEmojis, recentEmojis]);

  const themeRecentEmojis = useMemo(() => {
    const ret = [];
    if (recentEmojis?.length) {
      ret.unshift({
        id: RECENT_SYMBOL_SET_ID,
        name: lang('RecentStickers'),
        emojis: recentEmojis,
      });
    }

    return ret;
  }, [lang, recentEmojis]);

  // Initialize data on first render.
  useEffect(() => {
    setTimeout(() => {
      const exec = () => {
        setCategories(emojiData.categories);

        setEmojis(emojiData.emojis as AllEmojis);
      };

      if (emojiData) {
        exec();
      } else {
        ensureEmojiData()
          .then(exec);
      }
    }, OPEN_ANIMATION_DELAY);
  }, []);

  const selectCategoryWithResetSearch = useLastCallback((index: number) => {
    setIsSearching(SYMBOL_SEARCH_IS_DEFAULT);
    setResetSearching1(!resetSearching1);
    setEmojiIndex(index);
  });

  const selectCategory = useLastCallback((index: number) => {
    setActiveCategoryIndex(index);
    const categoryEl = containerRef.current!.closest<HTMLElement>('.SymbolMenu-main')!
      .querySelector(`#emoji-category-${index}`)! as HTMLElement;
    animateScroll({
      container: containerRef.current!,
      element: categoryEl,
      position: 'start',
      margin: FOCUS_MARGIN,
      maxDistance: SMOOTH_SCROLL_DISTANCE,
    });
  });

  useEffect(() => {
    if (emojiIndex === -1) {
      return;
    }
    selectCategory(emojiIndex);
  }, [emojiIndex, setActiveCategoryIndex, resetSearching1]);

  const handleEmojiSelect = useLastCallback((emoji: string, name: string) => {
    onEmojiSelect(emoji, name);
  });

  useHorizontalScroll(customHeaderRef, isMobile || !shouldRenderContent);

  // Scroll container and header when active set changes
  useEffect(() => {
    if (!areAddedLoaded) {
      return;
    }

    const header = customHeaderRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeSetIndex]);

  useHorizontalScroll(categoryRef, isMobile || !shouldRenderContent);

  // Scroll container and header when active set changes
  useEffect(() => {
    if (!areAddedLoaded || isTopOfContainer) {
      return;
    }

    const header = categoryRef.current;
    if (!header) {
      return;
    }

    const CATEGORY_BUTTON_WIDTH = 2 * REM;

    const newLeft = activeCategoryIndex * CATEGORY_BUTTON_WIDTH - (header.offsetWidth / 2 - CATEGORY_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeCategoryIndex, isTopOfContainer]);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
  });

  const handleSearch = useLastCallback((texts: string[], searching) => {
    setIsSearching(searching);
    if (texts && texts.length > 0) {
      const result: string[] = [];
      Object.values(emojiData?.emojis).forEach((value) => {
        const normalizedNames = value.names.map((n) => n.replace(/_/g, ' ').toLocaleLowerCase());
        const matched = texts.some((searchTerm) => {
          if (searchTerm?.length > 1) {
            return value.native === searchTerm
              || normalizedNames.some((n) => n.includes(searchTerm.toLocaleLowerCase()));
          }
          return false;
        });

        if (matched) {
          result.push(value.id);
        }
      });

      setSearchResults(result);
    } else {
      setSearchResults([]);
    }
  });

  const handleOnSelect = useLastCallback((icon) => {
    setIsSearching(SYMBOL_SEARCH_IS_SELECING_ICONS);
    const result: (ApiSticker | string)[] = [];

    Object.values(emojiData?.emojis).forEach((emoji) => {
      const matched = icon?.emojies.some((value: string) => {
        return emoji.native === value;
      });

      if (matched) {
        result.push(emoji?.id);
      }
    });

    allSets.forEach((item) => {
      item?.stickers?.forEach((sticker) => {
        if (icon?.emojies.some((emoji: string) => emoji === sticker.emoji)) {
          result.push(sticker);
        }
      });
    });
    setSearchResults(result);
  });

  const containerClassName = buildClassName('EmojiPicker', className);

  if (!shouldRenderContent) {
    return (
      <div className={containerClassName}>
        <Loading />
      </div>
    );
  }

  function renderCategoryButton(category: EmojiCategoryData, index: number) {
    const icon = ICONS_BY_CATEGORY[category.id];

    return icon && (
      <Button
        className={`symbol-set-button ${index === activeCategoryIndex ? 'activated' : ''}`}
        round
        faded
        color="translucent"
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => selectCategoryWithResetSearch(index)}
        ariaLabel={category.name}
      >
        <Icon name={icon} />
      </Button>
    );
  }

  function renderSearch(sticker: ApiSticker | string) {
    if (typeof sticker === 'string') {
      const emoji = emojis?.[sticker];
      if (!emoji) {
        return undefined;
      }
      const displayedEmoji = 'id' in emoji ? emoji : emoji[1];

      return (
        <EmojiButton
          key={displayedEmoji.id}
          emoji={displayedEmoji}
          onClick={onEmojiSelect}
        />
      );
    } else {
      return (
        <StickerButton
          key={sticker.id}
          size={EMOJI_SIZE_PICKER}
          sticker={sticker}
          observeIntersection={observeIntersectionForPlayingItems}
          observeIntersectionForShowing={observeIntersectionForShowingItems}
          noPlay={!loadAndPlay}
          isSavedMessages={isSavedMessages}
          isStatusPicker={isStatusPicker}
          canViewSet
          isCurrentUserPremium={isCurrentUserPremium}
          withTranslucentThumb={isTranslucent}
          onClick={onCustomEmojiSelect}
          clickArg={sticker}
          onContextMenuOpen={onContextMenuOpen}
          onContextMenuClose={onContextMenuClose}
          onContextMenuClick={onContextMenuClick}
          forcePlayback
        />
      );
    }
  }

  const headerClassName = buildClassName(
    'EmojiPicker-header',
    !shouldHideTopBorder && 'with-top-border',
    isSearching === SYMBOL_SEARCH_IS_TYPING && 'not-shown',
  );

  const customHeaderClassName = buildClassName(
    pickerStyles.header,
    pickerStyles.headerFixWidth,
    'no-scrollbar',
    !shouldHideTopBorder && pickerStyles.headerWithBorder,
  );

  return (
    <div className={containerClassName}>

      <div
        ref={headerRef}
        className={headerClassName}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {themeRecentEmojis.map(renderCategoryButton)}
        <div ref={categoryRef} className={buildClassName('categories', !isTopOfContainer && 'expanded')}>
          {allCategories.map((category, index) => renderCategoryButton(category, index + 1))}
        </div>

        <div
          ref={customHeaderRef}
          className={customHeaderClassName}
        >
          <div className="shared-canvas-container">
            <CustomEmojiCover
              activeSetIndex={activeSetIndex}
              selectStickerSet={selectStickerSetWithRestSearch}
              canAnimate={canAnimate}
              canLoadAndPlay={canLoadAndPlay}
              isTranslucent={isTranslucent}
              observeIntersectionForCovers={observeIntersectionForCovers}
              allSets={allSets}
            />
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleContentScroll}
        className={buildClassName('EmojiPicker-main',
          !!isSearching || IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
          isSearching === SYMBOL_SEARCH_IS_TYPING && 'searching')}
      >
        <SymbolSearch
          onSearch={handleSearch}
          placeholder="SearchEmoji"
          onSelect={handleOnSelect}
          onReset={resetSearching || resetSearching1}
        />
        {!!isSearching && (
          <div
            className={buildClassName('SymbolSearchResult custom-scroll',
              isSearching === SYMBOL_SEARCH_IS_SELECING_ICONS
              && 'no-header')}
          >
            <EmojiCategoryWrapper
              shouldRender
              index={0}
              category={{ id: '0', name: '', emojis: searchResults ? Object.keys(searchResults) : [] }}
            >
              {searchResults?.map((sticker) => (
                renderSearch(sticker)
              ))}
            </EmojiCategoryWrapper>
          </div>
        )}
        <div className={buildClassName(!!isSearching && 'not-shown')}>
          <EmojiCategoryWrapper
            shouldRender
            index={0}
            category={{ id: '0', name: '', emojis: themeRecent ? Object.keys(themeRecent) : [] }}
          >
            {themeRecent?.map((sticker) => (
              renderSearch(sticker)
            ))}
          </EmojiCategoryWrapper>

          {allCategories.map((category, i) => (
            <EmojiCategory
              category={category}
              index={i}
              allEmojis={emojis}
              observeIntersection={observeIntersection}
              shouldRender={activeCategoryIndex >= i - 1 && activeCategoryIndex <= i + 1}
              onEmojiSelect={handleEmojiSelect}
            />
          ))}

          {allSets.map((stickerSet, i) => {
            const shouldHideHeader = stickerSet.id === TOP_SYMBOL_SET_ID
              || (stickerSet.id === RECENT_SYMBOL_SET_ID && (withDefaultTopicIcons || isStatusPicker));
            const isChatEmojiSet = stickerSet.id === chatEmojiSetId;

            return (
              <StickerSet
                key={stickerSet.id}
                stickerSet={stickerSet}
                loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
                index={i}
                idPrefix={prefix}
                observeIntersection={observeIntersectionForSet}
                observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
                isSavedMessages={isSavedMessages}
                isStatusPicker={isStatusPicker}
                isReactionPicker={isReactionPicker}
                shouldHideHeader={shouldHideHeader}
                withDefaultTopicIcon={withDefaultTopicIcons && stickerSet.id === RECENT_SYMBOL_SET_ID}
                withDefaultStatusIcon={isStatusPicker && stickerSet.id === RECENT_SYMBOL_SET_ID}
                isChatEmojiSet={isChatEmojiSet}
                isCurrentUserPremium={isCurrentUserPremium}
                selectedReactionIds={selectedReactionIds}
                availableReactions={availableReactions}
                isTranslucent={isTranslucent}
                onReactionSelect={onReactionSelect}
                onReactionContext={onReactionContext}
                onStickerSelect={handleCustomEmojiSelect}
                onContextMenuOpen={onContextMenuOpen}
                onContextMenuClose={onContextMenuClose}
                onContextMenuClick={onContextMenuClick}
                forcePlayback
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
    // console.log(emojiData);
  }

  return emojiDataPromise;
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId, isStatusPicker, isReactionPicker }): StateProps => {
    const {
      recentEmojis,
      stickers: {
        setsById: stickerSetsById,
      },
      customEmojis: {
        byId: customEmojisById,
        featuredIds: customEmojiFeaturedIds,
        statusRecent: {
          emojis: recentStatusEmojis,
        },
      },
      recentCustomEmojis: recentCustomEmojiIds,
      reactions: {
        availableReactions,
        recentReactions,
        topReactions,
        defaultTags,
      },
    } = global;

    const isSavedMessages = Boolean(chatId && selectIsChatWithSelf(global, chatId));
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;

    return {
      recentEmojis,
      customEmojisById: !isStatusPicker ? customEmojisById : undefined,
      recentCustomEmojiIds: !isStatusPicker ? recentCustomEmojiIds : undefined,
      recentStatusEmojis: isStatusPicker ? recentStatusEmojis : undefined,
      stickerSetsById,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      canAnimate: selectCanPlayAnimatedEmojis(global),
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      customEmojiFeaturedIds,
      defaultTopicIconsId: global.defaultTopicIconsId,
      defaultStatusIconsId: global.defaultStatusIconsId,
      topReactions: isReactionPicker ? topReactions : undefined,
      recentReactions: isReactionPicker ? recentReactions : undefined,
      chatEmojiSetId: chatFullInfo?.emojiSet?.id,
      isWithPaidReaction: isReactionPicker && chatFullInfo?.isPaidReactionAvailable,
      availableReactions: isReactionPicker ? availableReactions : undefined,
      defaultTagReactions: isReactionPicker ? defaultTags : undefined,
    };
  },
)(EmojiPicker));
