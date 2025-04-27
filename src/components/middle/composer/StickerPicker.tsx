import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiSticker, ApiStickerSet } from '../../../api/types';
import type { StickerSetOrReactionsSetOrRecent, ThreadId } from '../../../types';

import {
  CHAT_STICKER_SET_ID,
  EFFECT_EMOJIS_SET_ID,
  EFFECT_STICKERS_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SEARCH_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER,
} from '../../../config';
import { isUserId } from '../../../global/helpers';
import {
  selectChat, selectChatFullInfo,
  selectIsChatWithSelf, selectIsCurrentUserPremium, selectShouldLoopStickers,
  selectTabState,
} from '../../../global/selectors';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import buildClassName from '../../../util/buildClassName';
import { pickTruthy } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import { REM } from '../../common/helpers/mediaDimensions';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useScrolledState from '../../../hooks/useScrolledState';
import useSendMessageAction from '../../../hooks/useSendMessageAction';
import { useStickerPickerObservers } from '../../common/hooks/useStickerPickerObservers';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import StickerButton from '../../common/StickerButton';
import StickerSet from '../../common/StickerSet';
import StickerSearch from '../../right/StickerSearch';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import StickerSetCover from './StickerSetCover';
import SymbolSearch, { SYMBOL_SEARCH_IS_DEFAULT, SYMBOL_SEARCH_IS_SELECING_ICONS, SYMBOL_SEARCH_IS_TYPING } from './SymbolSearch';

import styles from './StickerPicker.module.scss';

type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  className: string;
  isHidden?: boolean;
  isTranslucent?: boolean;
  loadAndPlay: boolean;
  canSendStickers?: boolean;
  noContextMenus?: boolean;
  idPrefix: string;
  onStickerSelect: (
    sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean, canUpdateStickerSetsOrder?: boolean,
  ) => void;
  isForEffects?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  recentStickers: ApiSticker[];
  favoriteStickers: ApiSticker[];
  effectStickers?: ApiSticker[];
  effectEmojis?: ApiSticker[];
  stickerSetsById: Record<string, ApiStickerSet>;
  chatStickerSetId?: string;
  addedSetIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  isModalOpen: boolean;
};

const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)

const StickerPicker: FC<OwnProps & StateProps> = ({
  chat,
  threadId,
  className,
  isHidden,
  isTranslucent,
  loadAndPlay,
  canSendStickers,
  recentStickers,
  favoriteStickers,
  effectStickers,
  effectEmojis,
  addedSetIds,
  stickerSetsById,
  chatStickerSetId,
  canAnimate,
  isSavedMessages,
  isCurrentUserPremium,
  noContextMenus,
  idPrefix,
  onStickerSelect,
  isForEffects,
  isModalOpen,
}) => {
  const {
    loadRecentStickers,
    addRecentSticker,
    unfaveSticker,
    faveSticker,
    removeRecentSticker,
    setStickerSearchQuery,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const searchIconsRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);

  const [searchIcons, setSearchIcons] = useState<ApiStickerSet[]>([]);
  const [allStickers, setAllStickers] = useState<ApiStickerSet[]>([]);
  const [isSearching, setIsSearching] = useState<number>(SYMBOL_SEARCH_IS_DEFAULT);
  const [resetSearching, setResetSearching] = useState(false);
  const [stickerIndex, setStickerIndex] = useState(-1);
  // const [isIconSearching, setIsIconSearching] = useState<boolean>(false);
  // const [isTyping, setIsTyping] = useState(false);
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const sendMessageAction = useSendMessageAction(chat?.id, threadId);

  const prefix = `${idPrefix}-sticker-set`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const selectStickerSetWithRestSearch = useLastCallback((index: number) => {
    setIsSearching(SYMBOL_SEARCH_IS_DEFAULT);
    setResetSearching(!resetSearching);
    setStickerIndex(index);
  });

  useEffect(() => {
    if (stickerIndex === -1) {
      return;
    }
    selectStickerSet(stickerIndex);
  }, [stickerIndex, selectStickerSet, resetSearching]);


  const lang = useOldLang();

  const areAddedLoaded = Boolean(addedSetIds);

  useEffect(() => {
    setAllStickers((prev) => {
      return [...prev, ...Object.values(stickerSetsById)];
    });
    return () => {
      setAllStickers([]);
    };
  }, [stickerSetsById]);

  const allSets = useMemo(() => {
    if (isForEffects && effectStickers) {
      const effectSets: StickerSetOrReactionsSetOrRecent[] = [];
      if (effectEmojis?.length) {
        effectSets.push({
          id: EFFECT_EMOJIS_SET_ID,
          accessHash: '0',
          title: '',
          stickers: effectEmojis,
          count: effectEmojis.length,
          isEmoji: true,
        });
      }
      if (effectStickers?.length) {
        effectSets.push({
          id: EFFECT_STICKERS_SET_ID,
          accessHash: '0',
          title: lang('StickerEffects'),
          stickers: effectStickers,
          count: effectStickers.length,
        });
      }
      return effectSets;
    }

    if (!addedSetIds) {
      return MEMO_EMPTY_ARRAY;
    }

    const defaultSets = [];

    if (favoriteStickers.length) {
      defaultSets.push({
        id: FAVORITE_SYMBOL_SET_ID,
        accessHash: '0',
        title: lang('FavoriteStickers'),
        stickers: favoriteStickers,
        count: favoriteStickers.length,
      });
    }

    if (recentStickers.length) {
      defaultSets.push({
        id: RECENT_SYMBOL_SET_ID,
        accessHash: '0',
        title: lang('RecentStickers'),
        stickers: recentStickers,
        count: recentStickers.length,
      });
    }

    const userSetIds = [...(addedSetIds || [])];
    if (chatStickerSetId) {
      userSetIds.unshift(chatStickerSetId);
    }

    const existingAddedSetIds = Object.values(pickTruthy(stickerSetsById, userSetIds));

    return [
      ...defaultSets,
      ...existingAddedSetIds,
    ];
  }, [
    addedSetIds,
    stickerSetsById,
    favoriteStickers,
    recentStickers,
    chatStickerSetId,
    lang,
    effectStickers,
    isForEffects,
    effectEmojis,
  ]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);

  useEffect(() => {
    if (!loadAndPlay) return;
    loadRecentStickers();
    if (!canSendStickers) return;
    sendMessageAction({ type: 'chooseSticker' });
  }, [canSendStickers, loadAndPlay, loadRecentStickers, sendMessageAction]);

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContents = areAddedLoaded && canRenderContents
    && !noPopulatedSets && (canSendStickers || isForEffects);

  useHorizontalScroll(headerRef, !shouldRenderContents || !headerRef.current);

  // Scroll container and header when active set changes
  useEffect(() => {
    if (!areAddedLoaded) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeSetIndex]);

  const handleOnSearch = useLastCallback((text: string[], searching) => {
    setIsSearching(searching);
    // setIsIconSearching(false);
    const query = text[0];
    setStickerSearchQuery({ query });
  });

  const handleOnSelect = useLastCallback((value) => {
    if (searchIconsRef?.current) {
      searchIconsRef.current.scrollTop = 0;
    }

    const result: ApiSticker[] = [];
    allStickers.forEach((item) => {
      item?.stickers?.forEach((sticker) => {
        if (value?.emojies.some((emoji: string) => emoji === sticker.emoji && !sticker.isCustomEmoji)) {
          result.push(sticker);
        }
      });
    });

    // console.log('found', result, result?.length, allStickers);
    // setIsIconSearching(true);
    setIsSearching(SYMBOL_SEARCH_IS_SELECING_ICONS);
    setSearchIcons([{
      id: SEARCH_SYMBOL_SET_ID,
      accessHash: '0',
      title: lang('SearchSticker'),
      stickers: result,
      count: result.length,
      shortName: '',
    }]);
  });

  // const handleOnChange = useLastCallback((searching) => {
  //   setIsTyping(searching);
  // });

  const handleStickerSelect = useLastCallback((sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => {
    onStickerSelect(sticker, isSilent, shouldSchedule, true);
    addRecentSticker({ sticker });
  });

  const handleStickerUnfave = useLastCallback((sticker: ApiSticker) => {
    unfaveSticker({ sticker });
  });

  const handleStickerFave = useLastCallback((sticker: ApiSticker) => {
    faveSticker({ sticker });
  });

  const handleMouseMove = useLastCallback(() => {
    if (!canSendStickers) return;
    sendMessageAction({ type: 'chooseSticker' });
  });

  const handleRemoveRecentSticker = useLastCallback((sticker: ApiSticker) => {
    removeRecentSticker({ sticker });
  });

  if (!chat) return undefined;

  const fullClassName = buildClassName(styles.root, className);

  if (!shouldRenderContents) {
    return (
      <div className={fullClassName}>
        {!canSendStickers && !isForEffects ? (
          <div className={styles.pickerDisabled}>{lang('ErrorSendRestrictedStickersAll')}</div>
        ) : noPopulatedSets ? (
          <div className={styles.pickerDisabled}>{lang('NoStickers')}</div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  function renderCover(stickerSet: StickerSetOrReactionsSetOrRecent, index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(styles.stickerCover, index === activeSetIndex && styles.activated);
    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;

    if (stickerSet.id === RECENT_SYMBOL_SET_ID
      || stickerSet.id === FAVORITE_SYMBOL_SET_ID
      || stickerSet.id === CHAT_STICKER_SET_ID
      || stickerSet.hasThumbnail
      || !firstSticker
    ) {
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={stickerSet.id === RECENT_SYMBOL_SET_ID || stickerSet.id === FAVORITE_SYMBOL_SET_ID}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => selectStickerSetWithRestSearch(index)}
        >
          {stickerSet.id === RECENT_SYMBOL_SET_ID ? (
            <Icon name="recent" />
          ) : stickerSet.id === FAVORITE_SYMBOL_SET_ID ? (
            <Icon name="favorite" />
          ) : stickerSet.id === CHAT_STICKER_SET_ID ? (
            <Avatar peer={chat} size="small" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate || !loadAndPlay}
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
              forcePlayback
            />
          )}
        </Button>
      );
    } else {
      return (
        <StickerButton
          key={stickerSet.id}
          sticker={firstSticker}
          size={STICKER_SIZE_PICKER_HEADER}
          title={stickerSet.title}
          className={buttonClassName}
          noPlay={!canAnimate || !loadAndPlay}
          observeIntersection={observeIntersectionForCovers}
          noContextMenu
          isCurrentUserPremium
          sharedCanvasRef={withSharedCanvas ? sharedCanvasRef : undefined}
          withTranslucentThumb={isTranslucent}
          onClick={selectStickerSet}
          clickArg={index}
          forcePlayback
        />
      );
    }
  }

  const headerClassName = buildClassName(
    styles.header,
    'no-scrollbar',
    !shouldHideTopBorder && styles.headerWithBorder,
    isSearching === SYMBOL_SEARCH_IS_TYPING && 'not-shown',
  );

  return (
    <div className={fullClassName}>
      {!isForEffects && (
        <div ref={headerRef} className={headerClassName}>
          <div className="shared-canvas-container">
            <canvas ref={sharedCanvasRef} className="shared-canvas" />
            {allSets.map(renderCover)}
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onScroll={handleContentScroll}
        className={
          buildClassName(
            styles.main,
            (IS_TOUCH_ENV || isSearching) ? 'no-scrollbar' : 'custom-scroll',
            (isSearching !== SYMBOL_SEARCH_IS_TYPING && !isForEffects) && styles.hasHeader,
          )
        }
      >
        <SymbolSearch
          onSearch={handleOnSearch}
          placeholder="SearchSticker"
          onSelect={handleOnSelect}
          onReset={resetSearching}
        />

        {isSearching === SYMBOL_SEARCH_IS_SELECING_ICONS && (
          <div className={buildClassName('SymbolSearchResult no-header')}>
            <div ref={searchIconsRef} className="StickerSearch custom-scroll">
              {searchIcons.map((stickerSet, i) => (
                <StickerSet
                  key={stickerSet.id}
                  stickerSet={stickerSet}
                  loadAndPlay={Boolean(canAnimate && loadAndPlay)}
                  noContextMenus={noContextMenus}
                  index={i}
                  idPrefix={prefix}
                  observeIntersection={observeIntersectionForSet}
                  observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
                  observeIntersectionForShowingItems={observeIntersectionForShowingItems}
                  isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
                  favoriteStickers={favoriteStickers}
                  isSavedMessages={isSavedMessages}
                  isCurrentUserPremium={isCurrentUserPremium}
                  isTranslucent={isTranslucent}
                  isChatStickerSet={stickerSet.id === chatStickerSetId}
                  onStickerSelect={handleStickerSelect}
                  onStickerUnfave={handleStickerUnfave}
                  onStickerFave={handleStickerFave}
                  onStickerRemoveRecent={handleRemoveRecentSticker}
                  forcePlayback
                  shouldHideHeader={stickerSet.id === EFFECT_EMOJIS_SET_ID}
                />
              ))}
            </div>
          </div>
        )}

        {isSearching === SYMBOL_SEARCH_IS_TYPING && (
          <div className={buildClassName('SymbolSearchResult no-header')}>
            <StickerSearch />
          </div>
        )}

        <div className={isSearching ? 'not-shown' : ''}>
          {allSets.map((stickerSet, i) => (
            <StickerSet
              key={stickerSet.id}
              stickerSet={stickerSet}
              loadAndPlay={Boolean(canAnimate && loadAndPlay)}
              noContextMenus={noContextMenus}
              index={i}
              idPrefix={prefix}
              observeIntersection={observeIntersectionForSet}
              observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
              observeIntersectionForShowingItems={observeIntersectionForShowingItems}
              isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
              favoriteStickers={favoriteStickers}
              isSavedMessages={isSavedMessages}
              isCurrentUserPremium={isCurrentUserPremium}
              isTranslucent={isTranslucent}
              isChatStickerSet={stickerSet.id === chatStickerSetId}
              onStickerSelect={handleStickerSelect}
              onStickerUnfave={handleStickerUnfave}
              onStickerFave={handleStickerFave}
              onStickerRemoveRecent={handleRemoveRecentSticker}
              forcePlayback
              shouldHideHeader={stickerSet.id === EFFECT_EMOJIS_SET_ID}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const {
      setsById,
      added,
      recent,
      favorite,
      effect,
    } = global.stickers;

    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const chat = selectChat(global, chatId);
    const chatStickerSetId = !isUserId(chatId) ? selectChatFullInfo(global, chatId)?.stickerSet?.id : undefined;

    return {
      chat,
      effectStickers: effect?.stickers,
      effectEmojis: effect?.emojis,
      recentStickers: recent.stickers,
      favoriteStickers: favorite.stickers,
      stickerSetsById: setsById,
      addedSetIds: added.setIds,
      canAnimate: selectShouldLoopStickers(global),
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      chatStickerSetId,
      isModalOpen: Boolean(selectTabState(global).openedStickerSetShortName),
    };
  },
)(StickerPicker));
