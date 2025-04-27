import React, {
  type FC, memo,
  useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { SearchIcon } from '../../common/icons/emojiIcons';

import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import buildClassName from '../../../util/buildClassName';
import { REM } from '../../common/helpers/mediaDimensions';
import emojiIcons from '../../common/icons/emojiIcons';

import useAppLayout from '../../../hooks/useAppLayout';
import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import Loading from '../../ui/Loading';

import './SymbolSearch.scss';

export type OwnProps = {
  placeholder: string;
  withIcons?: boolean;
  spinnerColor?: 'yellow';
  spinnerBackgroundColor?: 'light';
  isLoading?: boolean;
  onSelect?: (value: SearchIcon) => void;
  onSearch: (query: string[], searching?: number) => void;
  onReset?: boolean;
};

export const SYMBOL_SEARCH_IS_DEFAULT = 0;
export const SYMBOL_SEARCH_IS_TYPING = 1;
export const SYMBOL_SEARCH_IS_SELECING_ICONS = 2;

const SymbolSearch: FC<OwnProps> = ({
  placeholder,
  withIcons = true,
  spinnerColor,
  spinnerBackgroundColor,
  isLoading,
  onSelect,
  onSearch,
  onReset,
}) => {
  const lang = useOldLang();

  // eslint-disable-next-line no-null/no-null
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const searchIconsRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const searchRef = useRef<HTMLInputElement>(null);

  const [showSearchInput, setShowSearchInput] = useState(true);
  const [showBack, setShowBack] = useState(false);
  const [isSearching, setIsSearching] = useState(SYMBOL_SEARCH_IS_DEFAULT);
  const [isSelected, setIsSelected] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [showIcons, setShowIcons] = useState(withIcons);
  const { isMobile } = useAppLayout();

  const inputHandler = useDebouncedCallback(() => {
    const text = searchRef?.current?.value;

    if ((text && text?.length > 0)) {
      setIsSearching(SYMBOL_SEARCH_IS_TYPING);
      setShowIcons(false);
    }

    onSearch(text ? [text || ''] : [], SYMBOL_SEARCH_IS_TYPING);
  }, [onSearch], 400, true);

  const resetSearchInput = useLastCallback(() => {
    if (searchRef?.current) {
      searchRef.current!.value = '';
      if (searchIconsRef?.current) {
        animateHorizontalScroll(searchIconsRef?.current, 0);
        setSearchKey('');
      }
      onSearch([], SYMBOL_SEARCH_IS_DEFAULT);
      setShowSearchInput(true);
      setShowBack(false);
      setIsSelected(false);
      if (withIcons) {
        setShowIcons(true);
      }
      setIsSearching(SYMBOL_SEARCH_IS_DEFAULT);
      searchRef?.current.blur();
    }
  });

  useHorizontalScroll(searchWrapperRef, isMobile, true, () => {
    if (searchIconsRef?.current) {
      if (searchIconsRef?.current?.scrollLeft > 0) {
        setShowSearchInput(false);
        setShowBack(true);
      } else {
        setShowSearchInput(true);
        if (searchRef.current!.value?.length === 0 && !isSelected) {
          setShowBack(false);
        }
      }
    }
  }, searchIconsRef);

  useEffect(() => {
    const searchIcons = searchIconsRef.current;
    if (!searchIcons) {
      return;
    }

    const index = Object.keys(emojiIcons).indexOf(searchKey);
    const newLeft = index * (2.25 * REM) - searchIcons.offsetWidth / 2 + (2.25 * REM) / 2;

    animateHorizontalScroll(searchIcons, newLeft);
  }, [searchKey]);

  useEffect(() => {
    resetSearchInput();
  }, [onReset]);
  const blurHandler = useLastCallback(() => {
    if (searchRef?.current?.value === '') {
      resetSearchInput();
    }
  });

  const focusHandler = useLastCallback(() => {
    onSearch([], SYMBOL_SEARCH_IS_TYPING);
    setIsSearching(SYMBOL_SEARCH_IS_TYPING);
    setShowIcons(false);
    setIsSelected(false);
    setShowBack(false);
  });

  const keydownHandler = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      resetSearchInput();
    }
  });

  return (
    <div className="SymbolSearch" ref={searchWrapperRef}>

      {isLoading ? (
        <Loading color={spinnerColor} backgroundColor={spinnerBackgroundColor} />
      ) : showBack ? (
        <Icon name="arrow-left" className="cursor" onClick={resetSearchInput} />
      ) : (
        <Icon name="search" className="search-icon" />
      )}

      <input
        ref={searchRef}
        placeholder={lang(placeholder)}
        onChange={inputHandler}
        onFocus={focusHandler}
        onBlur={blurHandler}
        onKeyDown={keydownHandler}
        className={buildClassName(!showSearchInput && 'not-shown', !showIcons && 'expanded')}
      />

      {isSearching === SYMBOL_SEARCH_IS_TYPING && (
        <i className="icon icon-close cursor" onClick={resetSearchInput} />
      )}

      {showIcons && (
        <div className={buildClassName('search-icons', 'no-scrollbar')} ref={searchIconsRef}>
          {Object.entries(emojiIcons).map(([key, value]) => (
            <button
              key={key}
              className={buildClassName(searchKey === key && isSelected ? 'active' : '')}
              type="button"
              aria-label={key}
              title={key}
              onClick={() => {
                setShowSearchInput(false);
                setShowBack(true);
                setIsSearching(SYMBOL_SEARCH_IS_SELECING_ICONS);
                setIsSelected(true);
                if (onSelect) {
                  onSelect(value);
                } else {
                  onSearch(value?.emojies ? value?.emojies : (value?.texts ? value?.texts : [key]),
                    SYMBOL_SEARCH_IS_SELECING_ICONS);
                }
                setSearchKey(key);
              }}
            >{value?.svg()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(SymbolSearch);
