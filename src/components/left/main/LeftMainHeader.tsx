import { getActions, withGlobal } from '../../../global';
import type { FC, StateHookSetter } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';

import type { GlobalState } from '../../../global/types';
import type { ISettings } from '../../../types';
import { LeftColumnContent, SettingsScreens } from '../../../types';

import {
  selectCanSetPasscode,
  selectCurrentMessageList,
  selectIsCurrentUserPremium,
  selectTabState,
  selectTheme,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { formatDateToString } from '../../../util/dates/dateFormat';
import { IS_APP } from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useConnectionStatus from '../../../hooks/useConnectionStatus';
import useElectronDrag from '../../../hooks/useElectronDrag';
import { useHotkeys } from '../../../hooks/useHotkeys';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import PeerChip from '../../common/PeerChip';
import StoryToggler from '../../story/StoryToggler';
import Button from '../../ui/Button';
import SearchInput from '../../ui/SearchInput';
import ShowTransition from '../../ui/ShowTransition';
import ConnectionStatusOverlay from '../ConnectionStatusOverlay';
import StatusButton from './StatusButton';

import './LeftMainHeader.scss';
import MainMenu from './MainMenu';

type OwnProps = {
  shouldHideSearch?: boolean;
  content: LeftColumnContent,
  setContent: StateHookSetter<LeftColumnContent>,
  contactsFilter: string;
  isClosingSearch?: boolean;
  shouldSkipTransition?: boolean;
  onSearchQuery: (query: string) => void;
  onReset: NoneToVoidFunction;
};

type StateProps =
  {
    orderedFolderIds?: number[];
    searchQuery?: string;
    isLoading: boolean;
    globalSearchChatId?: string;
    searchDate?: number;
    theme: ISettings['theme'];
    isMessageListOpen: boolean;
    isCurrentUserPremium?: boolean;
    isConnectionStatusMinimized: ISettings['isConnectionStatusMinimized'];
    areChatsLoaded?: boolean;
    hasPasscode?: boolean;
    canSetPasscode?: boolean;
  }
  & Pick<GlobalState, 'connectionState' | 'isSyncing' | 'isFetchingDifference'>;

const CLEAR_DATE_SEARCH_PARAM = { date: undefined };
const CLEAR_CHAT_SEARCH_PARAM = { id: undefined };

const LeftMainHeader: FC<OwnProps & StateProps> = ({
  orderedFolderIds,
  shouldHideSearch,
  content,
  setContent,
  contactsFilter,
  isClosingSearch,
  searchQuery,
  isLoading,
  isCurrentUserPremium,
  shouldSkipTransition,
  globalSearchChatId,
  searchDate,
  theme,
  connectionState,
  isSyncing,
  isFetchingDifference,
  isMessageListOpen,
  isConnectionStatusMinimized,
  areChatsLoaded,
  hasPasscode,
  canSetPasscode,
  onSearchQuery,

  onReset,
}) => {
  const {
    setGlobalSearchDate,
    setSettingOption,
    setGlobalSearchChatId,
    lockScreen,
    requestNextSettingsScreen,
    loadChatFolders,
  } = getActions();

  useEffect(() => {
    loadChatFolders()
  }, [])

  const oldLang = useOldLang();
  const lang = useLang();
  const { isMobile, isDesktop } = useAppLayout();

  const areContactsVisible = content === LeftColumnContent.Contacts;

  const selectedSearchDate = useMemo(() => {
    return searchDate
      ? formatDateToString(new Date(searchDate * 1000))
      : undefined;
  }, [searchDate]);

  const { connectionStatus, connectionStatusText, connectionStatusPosition } = useConnectionStatus(
    oldLang,
    connectionState,
    isSyncing || isFetchingDifference,
    isMessageListOpen,
    isConnectionStatusMinimized,
    !areChatsLoaded,
  );

  const handleLockScreenHotkey = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasPasscode) {
      lockScreen();
    } else {
      requestNextSettingsScreen({ screen: SettingsScreens.PasscodeDisabled });
    }
  });

  useHotkeys(useMemo(() => (canSetPasscode ? {
    'Ctrl+Shift+L': handleLockScreenHotkey,
    'Alt+Shift+L': handleLockScreenHotkey,
    'Meta+Shift+L': handleLockScreenHotkey,
    ...(IS_APP && { 'Mod+L': handleLockScreenHotkey }),
  } : undefined), [canSetPasscode]));


  const handleSearchFocus = useLastCallback(() => {
    if (!searchQuery) {
      onSearchQuery('');
    }
  });

  const toggleConnectionStatus = useLastCallback(() => {
    setSettingOption({ isConnectionStatusMinimized: !isConnectionStatusMinimized });
  });

  const handleLockScreen = useLastCallback(() => {
    lockScreen();
  });

  const isSearchFocused = (!isDesktop && !isMessageListOpen) && (
    Boolean(globalSearchChatId)
    || content === LeftColumnContent.GlobalSearch
    || content === LeftColumnContent.Contacts
  );

  useEffect(() => (isSearchFocused ? captureEscKeyListener(() => onReset()) : undefined), [isSearchFocused, onReset]);

  const searchInputPlaceholder = content === LeftColumnContent.Contacts
    ? lang('SearchFriends')
    : lang('Search');

  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  useElectronDrag(headerRef);

  const withStoryToggler = !isSearchFocused && !selectedSearchDate && !globalSearchChatId && !areContactsVisible;

  const searchContent = useMemo(() => {
    return (
      <>
        {selectedSearchDate && (
          <PeerChip
            icon="calendar"
            title={selectedSearchDate}
            canClose
            isMinimized={Boolean(globalSearchChatId)}
            className="left-search-picker-item"
            onClick={setGlobalSearchDate}
            isCloseNonDestructive
            clickArg={CLEAR_DATE_SEARCH_PARAM}
          />
        )}
        {globalSearchChatId && (
          <PeerChip
            className="left-search-picker-item"
            peerId={globalSearchChatId}
            onClick={setGlobalSearchChatId}
            canClose
            isMinimized
            clickArg={CLEAR_CHAT_SEARCH_PARAM}
          />
        )}
      </>
    );
  }, [globalSearchChatId, selectedSearchDate]);

  return (
    <div className="LeftMainHeader">
      <div id="LeftMainHeader" className="left-header" ref={headerRef}>
        {oldLang.isRtl && <div className="DropdownMenuFiller" />}
        <MainMenu
          className={buildClassName(orderedFolderIds && orderedFolderIds?.length > 1 && 'hide-in-wide')}
          content={content}
          setContent={setContent}
          shouldSkipTransition={shouldSkipTransition}
          onReset={onReset}
        />

        <SearchInput
          inputId="telegram-search-input"
          resultsItemSelector=".LeftSearch .ListItem-button"
          className={buildClassName(
            (globalSearchChatId || searchDate) ? 'with-picker-item' : undefined,
            shouldHideSearch && 'SearchInput--hidden',
            orderedFolderIds && orderedFolderIds?.length > 1 && 'full-width'
          )}
          value={isClosingSearch ? undefined : (contactsFilter || searchQuery)}
          focused={isSearchFocused}
          isLoading={isLoading || connectionStatusPosition === 'minimized'}
          spinnerColor={connectionStatusPosition === 'minimized' ? 'yellow' : undefined}
          spinnerBackgroundColor={connectionStatusPosition === 'minimized' && theme === 'light' ? 'light' : undefined}
          placeholder={searchInputPlaceholder}
          autoComplete="off"
          canClose={Boolean(globalSearchChatId || searchDate)}
          onChange={onSearchQuery}
          onReset={onReset}
          onFocus={handleSearchFocus}
          onSpinnerClick={connectionStatusPosition === 'minimized' ? toggleConnectionStatus : undefined}
        >
          {searchContent}
          <StoryToggler
            canShow={withStoryToggler}
          />
        </SearchInput>
        {isCurrentUserPremium && <StatusButton />}
        {hasPasscode && (
          <Button
            round
            ripple={!isMobile}
            size="smaller"
            color="translucent"
            ariaLabel={`${oldLang('ShortcutsController.Others.LockByPasscode')} (Ctrl+Shift+L)`}
            onClick={handleLockScreen}
            className={buildClassName(!isCurrentUserPremium && 'extra-spacing')}
          >
            <Icon name="lock" />
          </Button>
        )}
        <ShowTransition
          isOpen={connectionStatusPosition === 'overlay'}
          isCustom
          className="connection-state-wrapper"
        >
          <ConnectionStatusOverlay
            connectionStatus={connectionStatus}
            connectionStatusText={connectionStatusText!}
            onClick={toggleConnectionStatus}
          />
        </ShowTransition>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const {
      query: searchQuery, fetchingStatus, chatId, minDate,
    } = tabState.globalSearch;
    const {
      chatFolders: {
        orderedIds: orderedFolderIds,
      },
      connectionState, isSyncing, isFetchingDifference,
    } = global;
    const { isConnectionStatusMinimized } = global.settings.byKey;

    return {
      orderedFolderIds,
      searchQuery,
      isLoading: fetchingStatus ? Boolean(fetchingStatus.chats || fetchingStatus.messages) : false,
      globalSearchChatId: chatId,
      searchDate: minDate,
      theme: selectTheme(global),
      connectionState,
      isSyncing,
      isFetchingDifference,
      isMessageListOpen: Boolean(selectCurrentMessageList(global)),
      isConnectionStatusMinimized,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      areChatsLoaded: Boolean(global.chats.listIds.active),
      hasPasscode: Boolean(global.passcode.hasPasscode),
      canSetPasscode: selectCanSetPasscode(global),
    };
  },
)(LeftMainHeader));
