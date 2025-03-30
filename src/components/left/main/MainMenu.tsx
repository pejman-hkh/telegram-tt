import type { FC, StateHookSetter } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { LeftColumnContent } from '../../../types';

import { APP_NAME, DEBUG, IS_BETA } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { IS_ELECTRON, IS_MAC_OS } from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import { useFullscreenStatus } from '../../../hooks/window/useFullscreen';
import useLeftHeaderButtonRtlForumTransition from './hooks/useLeftHeaderButtonRtlForumTransition';

import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import LeftSideMenuItems from './LeftSideMenuItems';

type OwnProps = {
  content: LeftColumnContent;
  setContent: StateHookSetter<LeftColumnContent>;
  onReset: (forceReturnToChatList?: true | Event) => void;
  shouldSkipTransition?: boolean | undefined;
  shouldHideSearch?: boolean;
  className?: string;
};

type StateProps = {
};

const MainMenu: FC<OwnProps & StateProps> = ({
  content, setContent, onReset, shouldSkipTransition, shouldHideSearch, className,
}) => {
  const oldLang = useOldLang();
  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();

  const onSelectSettings = useLastCallback(() => {
    setContent(LeftColumnContent.Settings);
  });

  const onSelectContacts = useLastCallback(() => {
    setContent(LeftColumnContent.Contacts);
  });

  const { closeForumPanel } = getActions();

  const onSelectArchived = useLastCallback(() => {
    setContent(LeftColumnContent.Archived);
    closeForumPanel();
  });

  const isFullscreen = useFullscreenStatus();
  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  const { isMobile } = useAppLayout();

  const hasMenu = content === LeftColumnContent.ChatList;

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={hasMenu && !isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={hasMenu ? onTrigger : () => onReset()}
        ariaLabel={hasMenu ? oldLang('AccDescrOpenMenu2') : 'Return to chat list'}
      >
        <div className={buildClassName(
          'animated-menu-icon',
          !hasMenu && 'state-back',
          shouldSkipTransition && 'no-animation',
        )}
        />
      </Button>
    );
  }, [hasMenu, isMobile, oldLang, onReset, shouldSkipTransition]);

  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  return (
    <DropdownMenu
      trigger={MainButton}
      footer={`${APP_NAME} ${versionString}`}
      className={buildClassName(
        'main-menu',
        oldLang.isRtl && 'rtl',
        shouldHideSearch && oldLang.isRtl && 'right-aligned',
        shouldDisableDropdownMenuTransitionRef.current && oldLang.isRtl && 'disable-transition',
        className,
      )}
      forceOpen={isBotMenuOpen}
      positionX={shouldHideSearch && oldLang.isRtl ? 'right' : 'left'}
      transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
      onTransitionEnd={oldLang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
    >
      <LeftSideMenuItems
        onSelectArchived={onSelectArchived}
        onSelectContacts={onSelectContacts}
        onSelectSettings={onSelectSettings}
        onBotMenuOpened={markBotMenuOpen}
        onBotMenuClosed={unmarkBotMenuOpen}
      />
    </DropdownMenu>
  );
};

export default memo(MainMenu);
