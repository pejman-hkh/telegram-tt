import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiVideo } from '../../../api/types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { selectCurrentMessageList, selectIsChatWithSelf } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import GifButton from '../../common/GifButton';
import GifSearch from '../../right/GifSearch';
import Loading from '../../ui/Loading';
import SymbolSearch, { SYMBOL_SEARCH_IS_DEFAULT } from './SymbolSearch';

import './GifPicker.scss';

type OwnProps = {
  className: string;
  loadAndPlay: boolean;
  canSendGifs?: boolean;
  onGifSelect?: (gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

type StateProps = {
  savedGifs?: ApiVideo[];
  isSavedMessages?: boolean;
};

const INTERSECTION_DEBOUNCE = 300;

const GifPicker: FC<OwnProps & StateProps> = ({
  className,
  loadAndPlay,
  canSendGifs,
  savedGifs,
  isSavedMessages,
  onGifSelect,
}) => {
  const { loadSavedGifs, saveGif, setGifSearchQuery } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSearching, setIsSearching] = useState<number>(SYMBOL_SEARCH_IS_DEFAULT);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, debounceMs: INTERSECTION_DEBOUNCE });

  useEffect(() => {
    if (loadAndPlay) {
      loadSavedGifs();
    }
  }, [loadAndPlay, loadSavedGifs]);

  const handleUnsaveClick = useLastCallback((gif: ApiVideo) => {
    saveGif({ gif, shouldUnsave: true });
  });

  const canRenderContents = useAsyncRendering([], SLIDE_TRANSITION_DURATION);

  const handleGifSearch = useLastCallback((text: string[], searching) => {
    const query = text[0];
    setIsSearching(searching);
    setGifSearchQuery({ query });
  });

  return (
    <div>
      <div
        ref={containerRef}
        className={buildClassName('GifWrapper', className, (IS_TOUCH_ENV || isSearching)
          ? 'no-scrollbar'
          : 'custom-scroll')}
      >
        <SymbolSearch
          onSearch={handleGifSearch}
          placeholder="SearchGifsTitle"
        />
        {isSearching !== SYMBOL_SEARCH_IS_DEFAULT && (
          <GifSearch />
        )}
        <div className={buildClassName('GifPicker', isSearching ? 'not-shown' : '')}>
          {!canSendGifs ? (
            <div className="picker-disabled">Sending GIFs is not allowed in this chat.</div>
          ) : canRenderContents && savedGifs && savedGifs.length ? (
            savedGifs.map((gif) => (
              <GifButton
                key={gif.id}
                gif={gif}
                observeIntersection={observeIntersection}
                isDisabled={!loadAndPlay}
                onClick={canSendGifs ? onGifSelect : undefined}
                onUnsaveClick={handleUnsaveClick}
                isSavedMessages={isSavedMessages}
              />
            ))
          ) : canRenderContents && savedGifs ? (
            <div className="picker-disabled">No saved GIFs.</div>
          ) : (
            <Loading />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const isSavedMessages = Boolean(chatId) && selectIsChatWithSelf(global, chatId);
    return {
      savedGifs: global.gifs.saved.gifs,
      isSavedMessages,
    };
  },
)(GifPicker));
